import { useState } from 'react';
import { useGame, useGameDispatch } from '../context/GameContext';
import { getInitials, formatCurrency } from '../utils/helpers';

export default function SetupScreen() {
  const game = useGame();
  const dispatch = useGameDispatch();
  const [playerName, setPlayerName] = useState('');

  const chipValue = game.chipsPerBuyIn > 0 ? game.buyIn / game.chipsPerBuyIn : 0;

  const handleAddPlayer = (e) => {
    e.preventDefault();
    const name = playerName.trim();
    if (!name) return;
    if (game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert('Player already exists!');
      return;
    }
    dispatch({ type: 'ADD_PLAYER', payload: { name } });
    setPlayerName('');
  };

  const handleStartGame = () => {
    if (game.players.length < 2) {
      alert('You need at least 2 players to start a game.');
      return;
    }
    if (!game.buyIn || game.buyIn <= 0) {
      alert('Please set a valid buy-in amount.');
      return;
    }
    if (!game.chipsPerBuyIn || game.chipsPerBuyIn <= 0) {
      alert('Please set how many chips per buy-in.');
      return;
    }
    dispatch({ type: 'START_GAME' });
  };

  return (
    <div>
      <div className="card">
        <div className="card__title">⚙ Game Settings</div>

        <div className="input-group">
          <label className="input-group__label">Currency</label>
          <div className="select-group">
            <select
              value={game.currency}
              onChange={(e) =>
                dispatch({ type: 'SET_CURRENCY', payload: e.target.value })
              }
            >
              <option value="₪">₪ Shekel (ILS)</option>
              <option value="$">$ Dollar (USD)</option>
              <option value="€">€ Euro (EUR)</option>
            </select>
          </div>
        </div>

        <div className="input-group">
          <label className="input-group__label">Buy-in Amount</label>
          <input
            type="number"
            className="input-group__field"
            value={game.buyIn}
            onChange={(e) =>
              dispatch({ type: 'SET_BUYIN', payload: Number(e.target.value) })
            }
            onBlur={(e) => {
              const rounded = Math.round(Number(e.target.value) / 50) * 50;
              const final = Math.max(50, rounded);
              dispatch({ type: 'SET_BUYIN', payload: final });
            }}
            min="50"
            step="50"
            placeholder="e.g. 100"
          />
          <p className="input-group__hint">
            Must be a multiple of 50
          </p>
        </div>

        <div className="input-group">
          <label className="input-group__label">Chips per Buy-in</label>
          <input
            type="number"
            className="input-group__field"
            value={game.chipsPerBuyIn}
            onChange={(e) =>
              dispatch({ type: 'SET_CHIPS_PER_BUYIN', payload: Number(e.target.value) })
            }
            min="1"
            placeholder="e.g. 200"
          />
          <p className="input-group__hint">
            How many chips each player gets for the buy-in
          </p>
        </div>

        {chipValue > 0 && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(212, 168, 67, 0.1)',
              border: '1px solid rgba(212, 168, 67, 0.2)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              marginBottom: '8px',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Chip value:{' '}
            </span>
            <strong style={{ color: 'var(--gold)', fontSize: '1rem' }}>
              {formatCurrency(chipValue, game.currency)} per chip
            </strong>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__title">👥 Players</div>

        <form
          onSubmit={handleAddPlayer}
          style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}
        >
          <input
            type="text"
            className="input-group__field"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter player name..."
            style={{ flex: 1, marginBottom: 0 }}
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!playerName.trim()}
          >
            Add
          </button>
        </form>

        {game.players.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🃏</div>
            <p className="empty-state__text">
              No players yet. Add at least 2 players to start the game.
            </p>
          </div>
        ) : (
          <div>
            {game.players.map((player, index) => (
              <div
                key={player.id}
                className="player-row animate-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="player-row__avatar">
                  {getInitials(player.name)}
                </div>
                <div className="player-row__info">
                  <div className="player-row__name">{player.name}</div>
                </div>
                <button
                  className="btn btn--danger btn--icon"
                  onClick={() =>
                    dispatch({
                      type: 'REMOVE_PLAYER_SETUP',
                      payload: player.id,
                    })
                  }
                  title="Remove player"
                >
                  ✕
                </button>
              </div>
            ))}
            <p
              style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                marginTop: '12px',
              }}
            >
              {game.players.length} player{game.players.length !== 1 ? 's' : ''}{' '}
              ready
            </p>
          </div>
        )}
      </div>

      <button
        className="btn btn--primary btn--full"
        onClick={handleStartGame}
        disabled={game.players.length < 2}
        style={{ padding: '16px', fontSize: '1rem' }}
      >
        🎲 Start Game
      </button>
    </div>
  );
}