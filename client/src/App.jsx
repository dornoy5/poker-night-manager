import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider, useGame, useGameDispatch } from './context/GameContext';
import { ToastProvider } from './context/ToastContext';
import { SocketProvider } from './context/SocketContext';
import LoginScreen from './components/LoginScreen';
import GroupsScreen from './components/GroupsScreen';
import GroupDetailScreen from './components/GroupDetailScreen';
import GameHistoryDetailScreen from './components/GameHistoryDetailScreen';
import LiveObserverScreen from './components/LiveObserverScreen';
import ProfileScreen from './components/ProfileScreen';
import SetupScreen from './components/SetupScreen';
import GameScreen, { SaveStatusBanner } from './components/GameScreen';
import CashoutScreen from './components/CashoutScreen';
import SettlementScreen from './components/SettlementScreen';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getGroups, getGroup, joinGroup } from './api/authApi';
import { getGame } from './api/gameApi';
import { needsRealName } from './utils/helpers';
import { useSocket } from './context/SocketContext';
import { useToast } from './context/ToastContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Keep the phone screen on while a game is running (where the browser allows it)
function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock = null;
    let cancelled = false;
    const request = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock?.release();
      } catch {
        // Not allowed (battery saver, old browser): the game still works
      }
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}

function GameContent({ onBackToGroup, group, runningGame }) {
  const game = useGame();
  const dispatch = useGameDispatch();
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  useWakeLock(game.phase === 'active' || game.phase === 'cashout');

  // Every step of the night starts at the top of the screen
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [game.phase]);

  const handleBack = () => {
    if (game.phase === 'setup' && game.players.length > 0) {
      setShowBackConfirm(true);
    } else {
      onBackToGroup();
    }
  };

  const confirmBack = () => {
    dispatch({ type: 'NEW_GAME' });
    onBackToGroup();
  };

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <button
            className="btn btn--secondary btn--small"
            onClick={handleBack}
          >
            ← {group?.name}
          </button>
          {/* Opens in a new tab so the running game stays exactly where it is */}
          <a
            className="btn btn--secondary btn--small"
            href="/guide.html"
            target="_blank"
            rel="noopener"
            aria-label="How it works"
            title="How it works"
            style={{ minWidth: '40px', padding: '8px 12px', textDecoration: 'none' }}
          >
            ?
          </a>
        </div>
        <h1 className="header__logo">Poker Night</h1>
        <p className="header__subtitle">Game Manager</p>
        <div className="header__suits">♠ ♥ ♦ ♣</div>
      </header>

      <SaveStatusBanner />
      {game.phase === 'setup' && <SetupScreen group={group} runningGame={runningGame} />}
      {game.phase === 'active' && <GameScreen group={group} />}
      {game.phase === 'cashout' && <CashoutScreen />}
      {(game.phase === 'reviewing' || game.phase === 'settled') && <SettlementScreen />}

      {showBackConfirm && (
        <div className="modal-overlay" onClick={() => setShowBackConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Leave Setup?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '20px' }}>
              You have {game.players.length} player{game.players.length !== 1 ? 's' : ''} added. Going back will discard the setup.
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" onClick={() => setShowBackConfirm(false)}>
                Stay
              </button>
              <button
                className="btn btn--primary"
                onClick={confirmBack}
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// view: 'groups' | 'detail' | 'game' | 'history' | 'observer'
// Where the phone's Back button (and the in-app back buttons) lead from each screen
const PARENT_VIEW = { groups: 'groups', detail: 'groups', game: 'detail', history: 'detail', observer: 'detail', profile: 'groups' };

// An invite link looks like /?join=ABC123. Remember the code through the Google sign-in.
function capturePendingJoin() {
  const code = new URLSearchParams(window.location.search).get('join');
  if (code) {
    localStorage.setItem('pendingJoin', code.trim().toUpperCase());
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }
}
capturePendingJoin();

function AppContent() {
  const { user, loading } = useAuth();
  const socket = useSocket();
  const showToast = useToast();
  const [view, setView] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [groupsKey, setGroupsKey] = useState(0);
  const [runningGame, setRunningGame] = useState(null);

  // Moving forward adds a history step, so the phone's Back button walks back through the app
  const navigate = useCallback((next) => {
    setView(next);
    window.history.pushState({ pokerView: next }, '');
  }, []);

  const goBack = useCallback(() => {
    if (window.history.state?.pokerView) window.history.back();
    else setView((v) => PARENT_VIEW[v]);
  }, []);

  useEffect(() => {
    // After a reload the app starts on the groups list, so forget the screens of the last visit
    window.history.replaceState(null, '');
    const onPop = () => setView((v) => PARENT_VIEW[v]);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Reopening the app mid-game goes straight back into the game this phone was running
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!user || resumedRef.current) return;
    resumedRef.current = true;
    const gameId = localStorage.getItem('activeGameId');
    if (!gameId || localStorage.getItem('pendingJoin')) return;
    getGame(gameId)
      .then(async (game) => {
        if (!['active', 'cashout', 'reviewing'].includes(game.phase) || !game.groupId) return;
        const group = await getGroup(game.groupId);
        if (!group?._id) return;
        setSelectedGroup(group);
        setRunningGame(null);
        navigate('game');
      })
      .catch(() => {});
  }, [user, navigate]);

  // Someone whose name is still an email address gets asked for a real name, once per visit
  const askedNameRef = useRef(false);
  useEffect(() => {
    if (!user || askedNameRef.current || !needsRealName(user)) return;
    askedNameRef.current = true;
    // After this render, so any invite-link or resume navigation settles first
    Promise.resolve().then(() => navigate('profile'));
  }, [user, navigate]);

  // Finish an invite link once the user is signed in
  useEffect(() => {
    if (!user) return;
    const code = localStorage.getItem('pendingJoin');
    if (!code) return;
    localStorage.removeItem('pendingJoin');
    joinGroup(code)
      .then(async (result) => {
        let group = result?._id ? result : null;
        if (!group && result?.error === 'Already a member') {
          const groups = await getGroups();
          group = groups.find((g) => g.code === code) || null;
        }
        if (!group) {
          showToast(result?.error === 'Group not found' ? `No group with code ${code}. Check the link.` : 'Could not join the group. Try the code by hand.', 'error');
          return;
        }
        if (result?._id) showToast(`You joined ${group.name}`, 'success');
        setGroupsKey((k) => k + 1);
        setSelectedGroup(group);
        navigate('detail');
      })
      .catch(() => showToast('Could not join the group. Try the code by hand.', 'error'));
  }, [user, navigate, showToast]);

  // Join all group socket rooms after login
  useEffect(() => {
    if (!user || !socket) return;
    getGroups().then((groups) => {
      if (Array.isArray(groups)) {
        groups.forEach((g) => socket.emit('join-group', g._id));
      }
    }).catch(() => {});
  }, [user, socket]);

  // Listen for game-started — auto-navigate selected players into the game
  useEffect(() => {
    if (!socket || !user) return;
    // Players follow the game live; a manager can take over from the live screen
    const handleGameStarted = ({ gameId, groupId, groupName }) => {
      setSelectedGroup({ _id: groupId, name: groupName });
      setSelectedGame({ _id: gameId });
      navigate('observer');
    };
    socket.on('game-started', handleGameStarted);
    return () => socket.off('game-started', handleGameStarted);
  }, [socket, user, navigate]);

  // Open a running game for editing on this phone (its creator or a group manager)
  const manageGame = (game) => {
    localStorage.setItem('activeGameId', game._id);
    setRunningGame(null);
    navigate('game');
  };

  if (loading) {
    return (
      <div className="app" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🃏</div>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (view === 'profile') {
    return <ProfileScreen onBack={goBack} />;
  }

  if (view === 'groups') {
    return (
      <GroupsScreen
        key={groupsKey}
        onOpenProfile={() => navigate('profile')}
        onSelectGroup={(group) => {
          setSelectedGroup(group);
          navigate('detail');
        }}
      />
    );
  }

  if (view === 'detail') {
    return (
      <GroupDetailScreen
        group={selectedGroup}
        onBack={goBack}
        onNewGame={(rg) => { localStorage.removeItem('activeGameId'); setRunningGame(rg || null); navigate('game'); }}
        onManageGame={manageGame}
        onSelectGame={(game) => { setSelectedGame(game); navigate('history'); }}
        onLeaveGroup={() => { setSelectedGroup(null); setGroupsKey((k) => k + 1); setView('groups'); }}
        onWatchLive={(game) => { setSelectedGame(game); navigate('observer'); }}
      />
    );
  }

  if (view === 'history') {
    return (
      <GameHistoryDetailScreen
        game={selectedGame}
        onBack={goBack}
      />
    );
  }

  if (view === 'observer') {
    return (
      <LiveObserverScreen
        gameId={selectedGame._id}
        groupName={selectedGroup?.name}
        onManage={manageGame}
        onBack={goBack}
      />
    );
  }

  return (
    <GameProvider groupId={selectedGroup._id}>
      <GameContent
        onBackToGroup={goBack}
        group={selectedGroup}
        runningGame={runningGame}
      />
    </GameProvider>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
