import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { getGame } from '../api/gameApi';
import { formatCurrency, getInitials } from '../utils/helpers';

const PHASE_LABELS = {
  active: '🟢 Game in progress',
  cashout: '💰 Cashing out',
  reviewing: '📋 Reviewing results',
};

export default function LiveObserverScreen({ gameId, groupName, onBack }) {
  const socket = useSocket();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGame(gameId)
      .then((data) => { if (data && !data.error) setGame(data); })
      .finally(() => setLoading(false));
  }, [gameId]);

  useEffect(() => {
    if (!socket || !gameId) return;
    socket.emit('join-game', gameId);

    const handleUpdate = (updatedGame) => setGame(updatedGame);
    socket.on('game-updated', handleUpdate);

    return () => {
      socket.emit('leave-game', gameId);
      socket.off('game-updated', handleUpdate);
    };
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
          </div>

          {activePlayers.length > 0 && (
            <div className="card">
              <div className="card__title">🟢 Active Players</div>
              {activePlayers.map((p, i) => (
                <div key={p._id || i} className="player-row animate-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="player-row__avatar">{getInitials(p.name)}</div>
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
                    <div className="player-row__avatar">{getInitials(p.name)}</div>
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
