import { GameProvider, useGame } from './context/GameContext';
import SetupScreen from './components/SetupScreen';
import GameScreen from './components/GameScreen';
import CashoutScreen from './components/CashoutScreen';
import SettlementScreen from './components/SettlementScreen';

function AppContent() {
  const game = useGame();

  return (
    <div className="app">
      <header className="header">
        <h1 className="header__logo">Poker Night</h1>
        <p className="header__subtitle">Game Manager</p>
        <div className="header__suits">♠ ♥ ♦ ♣</div>
      </header>

      {game.phase === 'setup' && <SetupScreen />}
      {game.phase === 'active' && <GameScreen />}
      {game.phase === 'cashout' && <CashoutScreen />}
      {game.phase === 'settled' && <SettlementScreen />}
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}