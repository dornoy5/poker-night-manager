import { useMemo } from 'react';
import { calculateSettlements, formatCurrency, getInitials } from '../utils/helpers';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function GameHistoryDetailScreen({ game, onBack }) {
  const playerResults = game.players
    .map((p) => ({
      ...p,
      profit: (p.cashOut || 0) - p.totalIn,
    }))
    .sort((a, b) => b.profit - a.profit);

  const totalPot = game.players.reduce((sum, p) => sum + p.totalIn, 0);
  const biggestWinner = playerResults[0];
  const biggestLoser = playerResults[playerResults.length - 1];

  // Use stored settlements if available, otherwise recalculate
  const settlements = useMemo(() => {
    if (game.settlements && game.settlements.length > 0) return game.settlements;
    return calculateSettlements(
      game.players.map((p) => ({ name: p.name, totalIn: p.totalIn, cashOut: p.cashOut || 0 }))
    );
  }, [game]);

  const playerInstructions = useMemo(() => {
    const instructions = {};
    game.players.forEach((p) => { instructions[p.name] = { sends: [], receives: [] }; });
    settlements.forEach((s) => {
      instructions[s.from].sends.push({ to: s.to, amount: s.amount });
      instructions[s.to].receives.push({ from: s.from, amount: s.amount });
    });
    return instructions;
  }, [settlements, game.players]);

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <button className="btn btn--secondary btn--small" onClick={onBack}>
            ← Back
          </button>
        </div>
        <h1 className="header__logo">Poker Night</h1>
        <p className="header__subtitle">Game Manager</p>
        <div className="header__suits">♠ ♥ ♦ ♣</div>
      </header>

      {/* Game summary */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🏆</div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: 'var(--gold)' }}>
          {formatDate(game.createdAt)}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Total pot: {formatCurrency(totalPot, game.currency)} · {game.players.length} players
          {game.buyIn && ` · Buy-in: ${formatCurrency(game.buyIn, game.currency)}`}
        </p>
      </div>

      {/* Transfer Instructions */}
      <div className="card">
        <div className="card__title">📋 Transfer Instructions</div>

        {settlements.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__text">Everyone broke even! No transfers needed. 🎉</p>
          </div>
        ) : (
          playerResults.map((player) => {
            const info = playerInstructions[player.name];
            if (!info || (info.sends.length === 0 && info.receives.length === 0)) return null;

            return (
              <div
                key={player.name}
                style={{
                  padding: '16px',
                  background: 'var(--bg-darkest)',
                  border: '1px solid rgba(61, 122, 82, 0.15)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div className="player-row__avatar">{getInitials(player.name)}</div>
                  <strong style={{ fontSize: '1rem' }}>{player.name}</strong>
                  {player.profit > 0 ? (
                    <span className="chip chip--green" style={{ marginLeft: 'auto' }}>
                      Won +{formatCurrency(player.profit, game.currency)}
                    </span>
                  ) : player.profit < 0 ? (
                    <span className="chip chip--red" style={{ marginLeft: 'auto' }}>
                      Lost -{formatCurrency(Math.abs(player.profit), game.currency)}
                    </span>
                  ) : (
                    <span className="chip chip--gold" style={{ marginLeft: 'auto' }}>Even</span>
                  )}
                </div>

                {info.sends.map((s, i) => (
                  <p key={i} style={{ fontSize: '0.9rem', color: 'var(--danger)', padding: '6px 0', paddingLeft: '48px', lineHeight: 1.5 }}>
                    💸 Transfer <strong>{formatCurrency(s.amount, game.currency)}</strong> to <strong>{s.to}</strong>
                  </p>
                ))}
                {info.receives.map((r, i) => (
                  <p key={i} style={{ fontSize: '0.9rem', color: 'var(--success)', padding: '6px 0', paddingLeft: '48px', lineHeight: 1.5 }}>
                    💰 Receive <strong>{formatCurrency(r.amount, game.currency)}</strong> from <strong>{r.from}</strong>
                  </p>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Player Results */}
      <div className="card">
        <div className="card__title">📊 Player Results</div>

        {playerResults.map((player, index) => (
          <div key={player.name} className="player-row animate-in" style={{ animationDelay: `${index * 60}ms` }}>
            <div style={{ width: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', flexShrink: 0 }}>
              {index === 0 ? '👑' : index === playerResults.length - 1 ? '💀' : `#${index + 1}`}
            </div>
            <div className="player-row__avatar">{getInitials(player.name)}</div>
            <div className="player-row__info">
              <div className="player-row__name">{player.name}</div>
              <div className="player-row__stats">
                In: {formatCurrency(player.totalIn, game.currency)} · Out: {formatCurrency(player.cashOut || 0, game.currency)}
                {player.rebuys && player.rebuys.length > 0 && (
                  <span> · {player.rebuys.length} rebuy{player.rebuys.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <div>
              {player.profit > 0 ? (
                <span className="chip chip--green">+{formatCurrency(player.profit, game.currency)}</span>
              ) : player.profit < 0 ? (
                <span className="chip chip--red">-{formatCurrency(Math.abs(player.profit), game.currency)}</span>
              ) : (
                <span className="chip chip--gold">Even</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Game Highlights */}
      <div className="card">
        <div className="card__title">🎯 Game Highlights</div>
        <div style={{ fontSize: '0.9rem', lineHeight: 1.8 }}>
          <p>
            <span style={{ color: 'var(--text-muted)' }}>Biggest winner:</span>{' '}
            <strong style={{ color: 'var(--success)' }}>{biggestWinner.name}</strong>{' '}
            (+{formatCurrency(Math.max(0, biggestWinner.profit), game.currency)})
          </p>
          <p>
            <span style={{ color: 'var(--text-muted)' }}>Biggest loser:</span>{' '}
            <strong style={{ color: 'var(--danger)' }}>{biggestLoser.name}</strong>{' '}
            (-{formatCurrency(Math.max(0, Math.abs(biggestLoser.profit)), game.currency)})
          </p>
          <p>
            <span style={{ color: 'var(--text-muted)' }}>Total rebuys:</span>{' '}
            <strong>{game.players.reduce((sum, p) => sum + (p.rebuys ? p.rebuys.length : 0), 0)}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
