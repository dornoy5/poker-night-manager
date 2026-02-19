import { createContext, useContext, useReducer } from 'react';
import { generateId } from '../utils/helpers';

const GameContext = createContext(null);
const GameDispatchContext = createContext(null);

const initialState = {
  phase: 'setup',
  buyIn: 100,
  chipsPerBuyIn: 200,
  currency: '₪',
  players: [],
  gameStartedAt: null,
};

function gameReducer(state, action) {
  switch (action.type) {
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
      return { ...state, players: updatedPlayers, phase: 'settled' };
    }

    case 'NEW_GAME':
      return { ...initialState };

    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

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