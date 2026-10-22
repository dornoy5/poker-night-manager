import { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { generateId, roundMoney, calculateSettlements } from '../utils/helpers';
import { createGame, updateGame, getGame, ConflictError } from '../api/gameApi';
import { useSocket, useSocketRoom } from './SocketContext';
import { useToast } from './ToastContext';

const GameContext = createContext(null);
const GameDispatchContext = createContext(null);
const SaveStatusContext = createContext('saved');

const initialState = {
  phase: 'setup',
  buyIn: 100,
  chipsPerBuyIn: 200,
  currency: '₪',
  players: [],
  gameStartedAt: null,
  _id: null,
  groupId: null,
  rev: 0,
};

function newPlayer({ name, userId }, totalIn) {
  const id = generateId();
  return {
    _id: id,
    id,
    name,
    userId: userId || null,
    totalIn,
    rebuys: [],
    cashOut: null,
    cashOutChips: null,
    isActive: true,
    leftEarly: false,
    adjustment: 0,
  };
}

// Server documents use _id for players; the UI uses id. Keep both the same.
function fromServer(game) {
  return {
    ...game,
    rev: game.rev || 0,
    players: game.players.map((p) => ({ ...p, id: p._id || p.id || generateId() })),
  };
}

function gameReducer(state, action) {
  switch (action.type) {
    case 'LOAD_GAME':
      return { ...action.payload };

    case 'SET_SAVED':
      return { ...state, _id: action.payload._id, rev: action.payload.rev };

    case 'SET_BUYIN':
      return { ...state, buyIn: action.payload };

    case 'SET_CHIPS_PER_BUYIN':
      return { ...state, chipsPerBuyIn: action.payload };

    case 'SET_CURRENCY':
      return { ...state, currency: action.payload };

    case 'START_GAME':
      return {
        ...state,
        phase: 'active',
        gameStartedAt: Date.now(),
        players: action.payload.map((p) => newPlayer(p, state.buyIn)),
      };

    case 'ADD_PLAYER':
      return { ...state, players: [...state.players, newPlayer(action.payload, state.buyIn)] };

    case 'REMOVE_PLAYER':
      return { ...state, players: state.players.filter((p) => p.id !== action.payload) };

    case 'ADD_REBUY': {
      const { playerId, amount } = action.payload;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId
            ? { ...p, rebuys: [...p.rebuys, { amount, timestamp: Date.now() }], totalIn: p.totalIn + amount }
            : p
        ),
      };
    }

    case 'UNDO_LAST_REBUY':
      return {
        ...state,
        players: state.players.map((p) => {
          if (p.id !== action.payload || p.rebuys.length === 0) return p;
          const last = p.rebuys[p.rebuys.length - 1];
          return { ...p, rebuys: p.rebuys.slice(0, -1), totalIn: p.totalIn - last.amount };
        }),
      };

    case 'CASH_OUT_PLAYER': {
      const { playerId, chips } = action.payload;
      const chipValue = state.buyIn / state.chipsPerBuyIn;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId
            ? { ...p, cashOut: roundMoney(chips * chipValue), cashOutChips: chips, isActive: false, leftEarly: true, adjustment: 0 }
            : p
        ),
      };
    }

    // A player who left comes back to the table (or the cash-out was a mistake)
    case 'UNDO_CASH_OUT':
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.payload
            ? { ...p, cashOut: null, cashOutChips: null, isActive: true, leftEarly: false, adjustment: 0 }
            : p
        ),
      };

    case 'START_CASHOUT':
      return { ...state, phase: 'cashout' };

    case 'BACK_TO_ACTIVE':
      return { ...state, phase: 'active' };

    case 'FINISH_GAME':
      return { ...state, phase: 'reviewing' };

    // payload: { cashouts: [{ playerId, chips }], splitDifference: bool }
    case 'FINISH_GAME_WITH_CASHOUTS': {
      const chipValue = state.buyIn / state.chipsPerBuyIn;
      const { cashouts, splitDifference } = action.payload;
      let players = state.players.map((p) => {
        const c = cashouts.find((x) => x.playerId === p.id);
        if (!c) return p;
        return { ...p, cashOut: roundMoney(c.chips * chipValue), cashOutChips: c.chips, isActive: false, adjustment: 0 };
      });

      // Chips went missing (or appeared): share the money difference equally
      // between the players still at the table, so the night always balances.
      if (splitDifference && cashouts.length > 0) {
        const totalIn = players.reduce((s, p) => s + p.totalIn, 0);
        const totalOut = players.reduce((s, p) => s + (p.cashOut || 0), 0);
        const diffCents = Math.round((totalIn - totalOut) * 100);
        const ids = cashouts.map((c) => c.playerId);
        const share = Math.trunc(diffCents / ids.length);
        let remainder = diffCents - share * ids.length;
        players = players.map((p) => {
          if (!ids.includes(p.id)) return p;
          let cents = share;
          if (remainder !== 0) {
            cents += Math.sign(remainder);
            remainder -= Math.sign(remainder);
          }
          return { ...p, adjustment: cents / 100, cashOut: roundMoney(p.cashOut + cents / 100) };
        });
      }
      return { ...state, players, phase: 'reviewing' };
    }

    case 'BACK_TO_CASHOUT':
      return {
        ...state,
        phase: 'cashout',
        players: state.players.map((p) =>
          p.leftEarly ? p : { ...p, isActive: true, cashOut: null, adjustment: 0 }
        ),
      };

    case 'CONFIRM_FINISH':
      return { ...state, phase: 'settled' };

    case 'NEW_GAME':
      return { ...initialState, _id: null, groupId: state.groupId };

    default:
      return state;
  }
}

function toPayload(state) {
  const payload = {
    phase: state.phase,
    buyIn: state.buyIn,
    chipsPerBuyIn: state.chipsPerBuyIn,
    currency: state.currency,
    // `id` is the UI's copy of `_id`; the server doesn't need it
    players: state.players.map((p) => {
      const copy = { ...p };
      delete copy.id;
      return copy;
    }),
    gameStartedAt: state.gameStartedAt,
  };
  // Store who pays whom with the finished game, so history never has to recompute it
  if (state.phase === 'settled') {
    payload.settlements = calculateSettlements(
      state.players.map((p) => ({ name: p.name, totalIn: p.totalIn, cashOut: p.cashOut || 0 }))
    );
  }
  return payload;
}

export function GameProvider({ children, groupId }) {
  const [state, dispatch] = useReducer(gameReducer, { ...initialState, groupId: groupId || null });
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'offline'
  const socket = useSocket();
  const showToast = useToast();

  const stateRef = useRef(state);
  stateRef.current = state;
  const skipSyncRef = useRef(false);   // next state change came from the server: don't send it back
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const dirtyRef = useRef(false);      // a save failed; retry when the connection is back

  const loadFromServer = useCallback((game) => {
    skipSyncRef.current = true;
    dispatch({ type: 'LOAD_GAME', payload: fromServer(game) });
  }, []);

  // Resume the game this phone was running (or was asked to manage)
  useEffect(() => {
    const activeGameId = localStorage.getItem('activeGameId');
    if (!activeGameId) return;
    getGame(activeGameId)
      .then((game) => {
        const gameGroupId = game.groupId?.toString?.() || game.groupId;
        if ((groupId && gameGroupId && gameGroupId !== groupId.toString()) || game.phase === 'settled') {
          localStorage.removeItem('activeGameId');
          return;
        }
        loadFromServer(game);
      })
      .catch(() => {
        localStorage.removeItem('activeGameId');
      });
  }, [groupId, loadFromServer]);

  const syncToDb = useCallback(async () => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const current = stateRef.current;
    if (current.phase === 'setup' && !current._id) return;
    if (current.phase === 'reviewing') return; // nothing is saved until Finish Game is confirmed

    inFlightRef.current = true;
    setSaveStatus('saving');
    try {
      // stateRef is updated by hand too, so a save queued behind this one already sees the new id/rev
      if (!current._id) {
        const saved = await createGame({ ...toPayload(current), groupId: current.groupId });
        localStorage.setItem('activeGameId', saved._id);
        stateRef.current = { ...stateRef.current, _id: saved._id, rev: saved.rev || 0 };
        dispatch({ type: 'SET_SAVED', payload: { _id: saved._id, rev: saved.rev || 0 } });
      } else {
        const saved = await updateGame(current._id, { ...toPayload(current), rev: current.rev });
        stateRef.current = { ...stateRef.current, rev: saved.rev };
        dispatch({ type: 'SET_SAVED', payload: { _id: saved._id, rev: saved.rev } });
        if (saved.phase === 'settled') localStorage.removeItem('activeGameId');
      }
      dirtyRef.current = false;
      setSaveStatus('saved');
    } catch (err) {
      if (err instanceof ConflictError && err.game) {
        // Another manager saved first: show their version instead of overwriting it
        queuedRef.current = false;
        dirtyRef.current = false;
        loadFromServer(err.game);
        setSaveStatus('saved');
        showToast('Another manager changed the game. Check it and redo your last tap.', 'error');
      } else {
        dirtyRef.current = true;
        setSaveStatus('offline');
      }
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        syncToDb();
      }
    }
  }, [loadFromServer, showToast]);

  // Save whenever the game itself changes (not for changes that came from the server)
  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    syncToDb();
  }, [state.phase, state.players, syncToDb]);

  // Live updates from other managers. Our own saves come back with a rev we already have.
  useEffect(() => {
    if (!socket) return;
    const handleGameUpdated = (updatedGame) => {
      const current = stateRef.current;
      if (updatedGame._id !== current._id) return;
      if ((updatedGame.rev || 0) <= current.rev) return;
      if (inFlightRef.current || dirtyRef.current) return; // our save decides; a conflict reloads
      loadFromServer(updatedGame);
    };
    socket.on('game-updated', handleGameUpdated);
    return () => socket.off('game-updated', handleGameUpdated);
  }, [socket, loadFromServer]);

  // Back online: push what failed to save, or fetch what we missed
  useSocketRoom('join-game', 'leave-game', state._id, () => {
    if (dirtyRef.current) {
      syncToDb();
    } else if (stateRef.current._id) {
      getGame(stateRef.current._id)
        .then((game) => {
          if ((game.rev || 0) > stateRef.current.rev) loadFromServer(game);
        })
        .catch(() => {});
    }
  });

  return (
    <GameContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>
        <SaveStatusContext.Provider value={saveStatus}>
          {children}
        </SaveStatusContext.Provider>
      </GameDispatchContext.Provider>
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}

export function useGameDispatch() {
  return useContext(GameDispatchContext);
}

export function useSaveStatus() {
  return useContext(SaveStatusContext);
}
