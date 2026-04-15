import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { generateId } from '../utils/helpers';
import { createGame, updateGame, getGame } from '../api/gameApi';
import { useSocket } from './SocketContext';

const GameContext = createContext(null);
const GameDispatchContext = createContext(null);

const initialState = {
  phase: 'setup',
  buyIn: 100,
  chipsPerBuyIn: 200,
  currency: '₪',
  players: [],
  gameStartedAt: null,
  _id: null,
  groupId: null,
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'LOAD_GAME':
      return { ...action.payload };

    case 'SET_DB_ID':
      return { ...state, _id: action.payload };

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
        players: state.players.map((p) => ({
          ...p,
          totalIn: state.buyIn,
          rebuys: [],
          cashOut: null,
          cashOutChips: null,
          isActive: true,
        })),
      };

    case 'ADD_PLAYER': {
      const newPlayer = {
        id: generateId(),
        name: action.payload.name,
        totalIn: state.phase === 'active' ? state.buyIn : 0,
        rebuys: [],
        cashOut: null,
        cashOutChips: null,
        isActive: true,
      };
      return { ...state, players: [...state.players, newPlayer] };
    }

    case 'REMOVE_PLAYER_SETUP':
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.payload),
      };

    case 'ADD_REBUY': {
      const { playerId, amount } = action.payload;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                rebuys: [...p.rebuys, { amount, timestamp: Date.now() }],
                totalIn: p.totalIn + amount,
              }
            : p
        ),
      };
    }

    case 'CASH_OUT_PLAYER': {
      const { playerId, chips } = action.payload;
      const chipValue = state.buyIn / state.chipsPerBuyIn;
      const moneyAmount = Math.round(chips * chipValue * 100) / 100;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId
            ? { ...p, cashOut: moneyAmount, cashOutChips: chips, isActive: false }
            : p
        ),
      };
    }

    case 'START_CASHOUT':
      return { ...state, phase: 'cashout' };

    case 'BACK_TO_ACTIVE':
      return { ...state, phase: 'active' };

    case 'SET_PLAYER_CASHOUT': {
      const { playerId, amount } = action.payload;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId ? { ...p, cashOut: amount } : p
        ),
      };
    }

    case 'FINISH_GAME':
      return { ...state, phase: 'settled' };

    case 'FINISH_GAME_WITH_CASHOUTS': {
      const chipValue = state.buyIn / state.chipsPerBuyIn;
      const updatedPlayers = state.players.map((p) => {
        const cashout = action.payload.find((c) => c.playerId === p.id);
        if (cashout) {
          const moneyAmount = Math.round(cashout.chips * chipValue * 100) / 100;
          return { ...p, cashOut: moneyAmount, cashOutChips: cashout.chips, isActive: false };
        }
        return p;
      });
      return { ...state, players: updatedPlayers, phase: 'reviewing' };
    }

    case 'BACK_TO_CASHOUT':
      return {
        ...state,
        phase: 'cashout',
        players: state.players.map((p) => ({ ...p, isActive: true })),
      };

    case 'CONFIRM_FINISH':
      return { ...state, phase: 'settled' };

    case 'NEW_GAME':
      return { ...initialState, _id: null, groupId: state.groupId };

    default:
      return state;
  }
}

export function GameProvider({ children, groupId }) {
  const [state, dispatch] = useReducer(gameReducer, { ...initialState, groupId: groupId || null });
  const justCreatedRef = useRef(false);
  const isSyncingRef = useRef(false);
  const socket = useSocket();

  // Try to load an active game from the database on startup
  useEffect(() => {
    const activeGameId = localStorage.getItem('activeGameId');
    if (activeGameId) {
      getGame(activeGameId)
        .then((game) => {
          if (game && !game.error) {
            // Only resume if the game belongs to the current group
            const gameGroupId = game.groupId?.toString?.() || game.groupId;
            if (groupId && gameGroupId && gameGroupId !== groupId.toString()) {
              localStorage.removeItem('activeGameId');
              return;
            }
            const loaded = {
              ...game,
              players: game.players.map((p) => ({
                ...p,
                id: p._id || p.id || generateId(),
              })),
            };
            dispatch({ type: 'LOAD_GAME', payload: loaded });
          } else {
            localStorage.removeItem('activeGameId');
          }
        })
        .catch(() => {
          localStorage.removeItem('activeGameId');
        });
    }
  }, [groupId]);

  // Join/leave socket room when game ID is known
  useEffect(() => {
    if (!socket || !state._id) return;
    socket.emit('join-game', state._id);
    return () => {
      socket.emit('leave-game', state._id);
    };
  }, [socket, state._id]);

  // Listen for real-time updates from other clients
  useEffect(() => {
    if (!socket) return;

    const handleGameUpdated = (updatedGame) => {
      // Ignore if we're the one who triggered the update
      if (isSyncingRef.current) return;
      const loaded = {
        ...updatedGame,
        players: updatedGame.players.map((p) => ({
          ...p,
          id: p._id || p.id || generateId(),
        })),
      };
      dispatch({ type: 'LOAD_GAME', payload: loaded });
    };

    socket.on('game-updated', handleGameUpdated);
    return () => {
      socket.off('game-updated', handleGameUpdated);
    };
  }, [socket]);

  // Save to database whenever state changes (after game is created)
  const syncToDb = useCallback(async () => {
    if (state.phase === 'setup' && !state._id) return;
    if (state.phase === 'reviewing') return;

    try {
      if (!state._id) {
        const saved = await createGame({
          phase: state.phase,
          buyIn: state.buyIn,
          chipsPerBuyIn: state.chipsPerBuyIn,
          currency: state.currency,
          players: state.players,
          gameStartedAt: state.gameStartedAt,
          groupId: state.groupId,
        });
        if (saved._id) {
          justCreatedRef.current = true;
          dispatch({ type: 'SET_DB_ID', payload: saved._id });
          localStorage.setItem('activeGameId', saved._id);
        }
      } else {
        // Skip the sync triggered immediately after creation (data already in DB)
        if (justCreatedRef.current) {
          justCreatedRef.current = false;
          return;
        }
        isSyncingRef.current = true;
        await updateGame(state._id, {
          phase: state.phase,
          buyIn: state.buyIn,
          chipsPerBuyIn: state.chipsPerBuyIn,
          currency: state.currency,
          players: state.players,
          gameStartedAt: state.gameStartedAt,
        });
        setTimeout(() => { isSyncingRef.current = false; }, 500);

        if (state.phase === 'settled') {
          localStorage.removeItem('activeGameId');
        }
      }
    } catch (err) {
      console.error('Failed to sync game:', err);
    }
  }, [state]);

  useEffect(() => {
    syncToDb();
  }, [state.phase, state.players, syncToDb]);

  return (
    <GameContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>
        {children}
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