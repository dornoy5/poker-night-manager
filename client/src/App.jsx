import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import LoginScreen from './components/LoginScreen';
import GroupsScreen from './components/GroupsScreen';
import SetupScreen from './components/SetupScreen';
import GameScreen from './components/GameScreen';
import CashoutScreen from './components/CashoutScreen';
import SettlementScreen from './components/SettlementScreen';
import { useState } from 'react';

const GOOGLE_CLIENT_ID =
  '183302882327-enkcpucccbpki5mvlrobd0sa3n09n93c.apps.googleusercontent.com';

function GameContent({ onBack, groupName }) {
  const game = useGame();

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <button
            className="btn btn--secondary btn--small"
            onClick={onBack}
          >
            ← Groups
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {groupName}
          </span>
        </div>
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

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedGroup, setSelectedGroup] = useState(null);

  if (loading) {
    return (
      <div className="app" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🃏</div>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!selectedGroup) {
    return <GroupsScreen onSelectGroup={setSelectedGroup} />;
  }

  return (
    <GameProvider>
      <GameContent
        onBack={() => setSelectedGroup(null)}
        groupName={selectedGroup.name}
      />
    </GameProvider>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}