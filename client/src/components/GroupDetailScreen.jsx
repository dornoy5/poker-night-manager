import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGroupGames } from '../api/gameApi';
import { getInitials, formatCurrency } from '../utils/helpers';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function getWinner(players) {
  if (!players || players.length === 0) return null;
  return players
    .map((p) => ({ name: p.name, profit: (p.cashOut || 0) - p.totalIn }))
    .sort((a, b) => b.profit - a.profit)[0];
}

export default function GroupDetailScreen({ group, onBack, onNewGame, onSelectGame }) {
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGroupGames(group._id)
      .then((data) => {
        if (Array.isArray(data)) setGames(data.filter((g) => g.phase === 'settled'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [group._id]);

  const isManager = group.manager._id === user._id;

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <button className="btn btn--secondary btn--small" onClick={onBack}>
            ← Groups
          </button>
          {isManager && (
            <span className="chip chip--gold">Manager</span>
          )}
        </div>
        <h1 className="header__logo">Poker Night</h1>
        <p className="header__subtitle">Game Manager</p>
        <div className="header__suits">♠ ♥ ♦ ♣</div>
      </header>

      {/* Group info */}
      <div className="card">
        <div className="card__title">🎯 Group</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="player-row__avatar"
            style={{
              width: '48px',
              height: '48px',
              fontSize: '1rem',
              background: isManager
                ? 'linear-gradient(135deg, var(--gold-dim), var(--gold))'
                : undefined,
              color: isManager ? 'var(--bg-darkest)' : undefined,
            }}
          >
            {getInitials(group.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{group.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {group.members.length} member{group.members.length !== 1 ? 's' : ''} · Code:{' '}
              <strong style={{ color: 'var(--gold)', letterSpacing: '2px' }}>{group.code}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
          {group.members.map((m) => (
            <div
              key={m._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-darkest)',
                border: '1px solid rgba(61,122,82,0.2)',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '0.8rem',
              }}
            >
              {m.picture ? (
                <img src={m.picture} alt={m.name} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
              ) : (
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--felt-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
                  {getInitials(m.name)}
                </span>
              )}
              {m.name.split(' ')[0]}
              {m._id === group.manager._id && <span style={{ color: 'var(--gold)', fontSize: '0.65rem' }}>★</span>}
            </div>
          ))}
        </div>
      </div>

      {/* New game CTA */}
      <button
        className="btn btn--primary btn--full"
        onClick={onNewGame}
        style={{ padding: '16px', fontSize: '1rem', marginBottom: '16px' }}
      >
        🎲 New Game
      </button>

      {/* Game history */}
      <div className="card">
        <div className="card__title">📜 Game History</div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading...</p>
        ) : games.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🃏</div>
            <p className="empty-state__text">No completed games yet. Start your first game!</p>
          </div>
        ) : (
          games.map((game, index) => {
            const winner = getWinner(game.players);
            const totalPot = game.players.reduce((s, p) => s + p.totalIn, 0);
            return (
              <div
                key={game._id}
                className="player-row animate-in"
                style={{ animationDelay: `${index * 40}ms`, cursor: 'pointer' }}
                onClick={() => onSelectGame(game)}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'var(--bg-dark)',
                    border: '1px solid rgba(61,122,82,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                    flexShrink: 0,
                  }}
                >
                  🃏
                </div>
                <div className="player-row__info">
                  <div className="player-row__name">{formatDate(game.createdAt)}</div>
                  <div className="player-row__stats">
                    {game.players.length} players · Pot: {formatCurrency(totalPot, game.currency)}
                    {winner && ` · 👑 ${winner.name}`}
                  </div>
                </div>
                {winner && winner.profit > 0 && (
                  <span className="chip chip--green">
                    +{formatCurrency(winner.profit, game.currency)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
