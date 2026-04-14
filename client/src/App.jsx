import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import { ToastProvider } from './context/ToastContext';
import LoginScreen from './components/LoginScreen';
import GroupsScreen from './components/GroupsScreen';
import GroupDetailScreen from './components/GroupDetailScreen';
import GameHistoryDetailScreen from './components/GameHistoryDetailScreen';
import SetupScreen from './components/SetupScreen';
import GameScreen from './components/GameScreen';
import CashoutScreen from './components/CashoutScreen';
import SettlementScreen from './components/SettlementScreen';
import { useState } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GameContent({ onBackToGroup, groupName }) {
  const game = useGame();

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <button
            className="btn btn--secondary btn--small"
            onClick={onBackToGroup}
          >
            ← {groupName}
          </button>
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

// view: 'groups' | 'detail' | 'game' | 'history'
function AppContent() {
  const { user, loading } = useAuth();
  const [view, setView] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [groupsKey, setGroupsKey] = useState(0);

  if (loading) {
    return (
      <div className="app" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🃏</div>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (view === 'groups') {
    return (
      <GroupsScreen
        key={groupsKey}
        onSelectGroup={(group) => {
          setSelectedGroup(group);
          setView('detail');
        }}
      />
    );
  }

  if (view === 'detail') {
    return (
      <GroupDetailScreen
        group={selectedGroup}
        onBack={() => { setSelectedGroup(null); setView('groups'); }}
        onNewGame={() => setView('game')}
        onSelectGame={(game) => { setSelectedGame(game); setView('history'); }}
        onLeaveGroup={() => { setSelectedGroup(null); setGroupsKey((k) => k + 1); setView('groups'); }}
      />
    );
  }

  if (view === 'history') {
    return (
      <GameHistoryDetailScreen
        game={selectedGame}
        onBack={() => { setSelectedGame(null); setView('detail'); }}
      />
    );
  }

  return (
    <GameProvider groupId={selectedGroup._id}>
      <GameContent
        onBackToGroup={() => setView('detail')}
        groupName={selectedGroup.name}
      />
    </GameProvider>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
