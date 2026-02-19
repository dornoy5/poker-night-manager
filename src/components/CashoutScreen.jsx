import { useState } from 'react';
import { useGame, useGameDispatch } from '../context/GameContext';
import { formatCurrency, getInitials } from '../utils/helpers';

export default function CashoutScreen() {
  const game = useGame();
  const dispatch = useGameDispatch();

  const chipValue = game.buyIn / game.chipsPerBuyIn;

  const [chipAmounts, setChipAmounts] = useState(() => {
    const initial = {};
    game.players.forEach((p) => {
      if (p.cashOutChips !== null) {
        initial[p.id] = p.cashOutChips.toString();
      } else {
        initial[p.id] = '';
      }
    });
    return initial;
  });

  const [error, setError] = useState('');

  const activePlayers = game.players.filter((p) => p.isActive);
  const cashedOutPlayers = game.players.filter((p) => !p.isActive);

  const totalIn = game.players.reduce((sum, p) => sum + p.totalIn, 0);
  const totalChipsInPlay = totalIn / chipValue;

  const totalCashedOutAlready = cashedOutPlayers.reduce(
    (sum, p) => sum + (p.cashOutChips || 0),
    0
  );

  const currentEnteredChips = activePlayers.reduce((sum, p) => {
    const val = Number(chipAmounts[p.id]);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalChipsOut = currentEnteredChips + totalCashedOutAlready;
  const chipDifference = totalChipsOut - totalChipsInPlay;

  const allFilled = activePlayers.every(
    (p) => chipAmounts[p.id] !== '' && !isNaN(Number(chipAmounts[p.id]))
  );

  const handleFinish = () => {
    if (Math.abs(chipDifference) > 0.5) {
      setError(
        `Total chips out (${Math.round(totalChipsOut)}) doesn't match total chips in play (${Math.round(totalChipsInPlay)}). Difference: ${Math.round(Math.abs(chipDifference))} chips.`
      );
      return;
    }

    setError('');

    const cashouts = activePlayers.map((p) => ({
      playerId: p.id,
      chips: Number(chipAmounts[p.id]),
    }));

    dispatch({ type: 'FINISH_GAME_WITH_CASHOUTS', payload: cashouts });
  };

  return (
    <div>
      <div className="card">
        <div className="card__title">💰 Final Chip Count</div>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            marginBottom: '20px',
            lineHeight: 1.5,
          }}
        >
          Enter how many <strong>chips</strong> each player has. The app will convert to money automatically.
        </p>

        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(212, 168, 67, 0.1)',
            border: '1px solid rgba(212, 168, 67, 0.2)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            marginBottom: '16px',
            fontSize: '0.85rem',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>Chip value: </span>
          <strong style={{ color: 'var(--gold)' }}>{formatCurrency(chipValue, game.currency)}</strong>
          <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>·</span>
          <span style={{ color: 'var(--text-secondary)' }}>Total chips: </span>
          <strong style={{ color: 'var(--gold)' }}>{Math.round(totalChipsInPlay)}</strong>
        </div>

        <div className="summary-bar" style={{ marginBottom: '20px' }}>
          <div className="summary-stat">
            <div className="summary-stat__value">
              {Math.round(totalChipsInPlay)}
            </div>
            <div className="summary-stat__label">Total Chips</div>
          </div>
          <div className="summary-stat">
            <div
              className="summary-stat__value"
              style={{
                color:
                  Math.abs(chipDifference) < 0.5
                    ? 'var(--success)'
                    : 'var(--danger)',
              }}
            >
              {Math.round(totalChipsOut)}
            </div>
            <div className="summary-stat__label">Chips Out</div>
          </div>
          <div className="summary-stat">
            <div
              className="summary-stat__value"
              style={{
                color:
                  Math.abs(chipDifference) < 0.5
                    ? 'var(--success)'
                    : 'var(--danger)',
              }}
            >
              {chipDifference > 0 ? '+' : ''}{Math.round(chipDifference)}
            </div>
            <div className="summary-stat__label">Difference</div>
          </div>
        </div>

        {cashedOutPlayers.length > 0 && (
          <>
            <p
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: '8px',
              }}
            >
              Already cashed out
            </p>
            {cashedOutPlayers.map((player) => (
              <div
                key={player.id}
                className="player-row"
                style={{ opacity: 0.5 }}
              >
                <div className="player-row__avatar">
                  {getInitials(player.name)}
                </div>
                <div className="player-row__info">
                  <div className="player-row__name">{player.name}</div>
                  <div className="player-row__stats">
                    {player.cashOutChips} chips = {formatCurrency(player.cashOut, game.currency)}
                  </div>
                </div>
                <div className="player-row__amount">
                  {player.cashOutChips} chips
                </div>
              </div>
            ))}
            <div className="divider" />
          </>
        )}

        {activePlayers.map((player, index) => (
          <div
            key={player.id}
            className="player-row animate-in"
            style={{
              animationDelay: `${index * 50}ms`,
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div className="player-row__avatar">
              {getInitials(player.name)}
            </div>
            <div className="player-row__info" style={{ minWidth: '80px' }}>
              <div className="player-row__name">{player.name}</div>
              <div className="player-row__stats">
                In: {formatCurrency(player.totalIn, game.currency)}
                {chipAmounts[player.id] && !isNaN(Number(chipAmounts[player.id])) && (
                  <span> · = {formatCurrency(Number(chipAmounts[player.id]) * chipValue, game.currency)}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 'none' }}>
              <input
                type="number"
                className="input-group__field"
                value={chipAmounts[player.id]}
                onChange={(e) =>
                  setChipAmounts((prev) => ({
                    ...prev,
                    [player.id]: e.target.value,
                  }))
                }
                placeholder="Chips..."
                min="0"
                style={{
                  width: '100px',
                  padding: '8px 12px',
                  fontSize: '1rem',
                  textAlign: 'right',
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>chips</span>
            </div>
          </div>
        ))}

        {error && (
          <p
            style={{
              color: 'var(--danger)',
              fontSize: '0.85rem',
              marginTop: '16px',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            ⚠ {error}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          className="btn btn--primary btn--full"
          onClick={handleFinish}
          disabled={!allFilled}
          style={{ padding: '16px', fontSize: '1rem' }}
        >
          Calculate Settlement
        </button>
      </div>
    </div>
  );
}