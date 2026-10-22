import { useState, useEffect, useCallback } from 'react';
import { useSocket, useSocketRoom, useSocketConnected } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getGame } from '../api/gameApi';
import { getGroup } from '../api/authApi';
import { formatCurrency, getInitials, chipStyle } from '../utils/helpers';

const PHASE_LABELS = {
  active: '🟢 Game in progress',
  cashout: '💰 Cashing out',
  reviewing: '📋 Reviewing results',
  settled: '🏁 Game finished',
};

export default function LiveObserverScreen({ gameId, groupName, onBack, onManage }) {
  const socket = useSocket();
  const connected = useSocketConnected();
  const { user } = useAuth();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const refresh = useCallback(() => {
    return getGame(gameId)
      .then((data) => { if (data && !data.error) setGame(data); })
      .catch(() => {});
  }, [gameId]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Whoever started the game, or a group manager, can take it over from here
  useEffect(() => {
    if (!game?.groupId || !user) return;
    getGroup(game.groupId)
      .then((g) => {
        const ids = [game.createdBy, g.manager?._id || g.manager, ...(g.managers || []).map((m) => m._id || m)].map(String);
        setCanManage(ids.includes(user._id));
      })
      .catch(() => {});
  }, [game?.groupId, game?.createdBy, user]);

  // Re-join the live room after every reconnect, and fetch what we missed
  useSocketRoom('join-game', 'leave-game', gameId, refresh);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (updatedGame) => {
      if (updatedGame._id === gameId) setGame(updatedGame);
    };
    socket.on('game-updated', handleUpdate);
    return () => socket.off('game-updated', handleUpdate);
  }, [socket, gameId]);

  const activePlayers = game?.players.filter((p) => p.isActive) || [];
  const cashedOutPlayers = game?.players.filter((p) => !p.isActive) || [];
  const totalPot = game?.players.reduce((s, p) => s + p.totalIn, 0) || 0;

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <button className="btn btn--secondary btn--small" onClick={onBack}>
            ← {groupName}
          </button>
          <span className="chip chip--gold">Watching Live</span>
        </div>
        <h1 className="header__logo">Poker Night</h1>
        <p className="header__subtitle">Game Manager</p>
        <div className="header__suits">♠ ♥ ♦ ♣</div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading game...</div>
      ) : !game ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Game not found.</div>
      ) : (
        <>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 600, marginBottom: '8px' }}>
              {PHASE_LABELS[game.phase] || game.phase}
            </div>
            {!connected && (
              <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginBottom: '8px' }}>
                Reconnecting… numbers may be behind
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px' }}>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{game.players.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Players</div>
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--gold)' }}>
                  {formatCurrency(totalPot, game.currency)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Pot</div>
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{activePlayers.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active</div>
              </div>
            </div>
            {canManage && game.phase !== 'settled' && (
              <button className="btn btn--primary btn--full" onClick={() => onManage(game)} style={{ marginTop: '14px' }}>
                ✏ Manage this game
              </button>
            )}
          </div>

          {activePlayers.length > 0 && (
            <div className="card">
              <div className="card__title">🟢 Active Players</div>
              {activePlayers.map((p, i) => (
                <div key={p._id || i} className="player-row animate-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="player-row__avatar" style={chipStyle(p.name)}>{getInitials(p.name)}</div>
                  <div className="player-row__info">
                    <div className="player-row__name">{p.name}</div>
                    <div className="player-row__stats">
                      In: {formatCurrency(p.totalIn, game.currency)}
                      {p.rebuys?.length > 0 && ` · ${p.rebuys.length} rebuy${p.rebuys.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cashedOutPlayers.length > 0 && (
            <div className="card">
              <div className="card__title">🔴 Cashed Out</div>
              {cashedOutPlayers.map((p, i) => {
                const profit = (p.cashOut || 0) - p.totalIn;
                return (
                  <div key={p._id || i} className="player-row" style={{ opacity: 0.7 }}>
                    <div className="player-row__avatar" style={chipStyle(p.name)}>{getInitials(p.name)}</div>
                    <div className="player-row__info">
                      <div className="player-row__name">{p.name}</div>
                      <div className="player-row__stats">
                        In: {formatCurrency(p.totalIn, game.currency)} · Out: {formatCurrency(p.cashOut || 0, game.currency)}
                      </div>
                    </div>
                    <span className={`chip ${profit > 0 ? 'chip--green' : profit < 0 ? 'chip--red' : 'chip--gold'}`}>
                      {profit > 0 ? '+' : ''}{formatCurrency(profit, game.currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
