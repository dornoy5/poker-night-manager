import { useState } from 'react';
import { useGame, useGameDispatch } from '../context/GameContext';
import { formatCurrency, getInitials } from '../utils/helpers';

const REBUY_OPTIONS = [50, 100, 150, 200, 250, 300, 400, 500];

export default function GameScreen() {
  const game = useGame();
  const dispatch = useGameDispatch();

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [rebuyModalPlayer, setRebuyModalPlayer] = useState(null);
  const [cashoutModalPlayer, setCashoutModalPlayer] = useState(null);
  const [cashoutAmount, setCashoutAmount] = useState('');

  const activePlayers = game.players.filter((p) => p.isActive);
  const cashedOutPlayers = game.players.filter((p) => !p.isActive);
  const totalPot = game.players.reduce((sum, p) => sum + p.totalIn, 0);
  const totalCashedOut = cashedOutPlayers.reduce(
    (sum, p) => sum + (p.cashOut || 0),
    0
  );

  const handleAddPlayer = (e) => {
    e.preventDefault();
    const name = newPlayerName.trim();
    if (!name) return;
    if (
      game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())
    ) {
      alert('Player already in game!');
      return;
    }
    dispatch({ type: 'ADD_PLAYER', payload: { name } });
    setNewPlayerName('');
    setShowAddPlayer(false);
  };

  const handleRebuy = (amount) => {
    dispatch({
      type: 'ADD_REBUY',
      payload: { playerId: rebuyModalPlayer.id, amount },
    });
    setRebuyModalPlayer(null);
  };

  const handleEndGame = () => {
    if (activePlayers.length === 0) {
      dispatch({ type: 'FINISH_GAME' });
      return;
    }
    dispatch({ type: 'START_CASHOUT' });
  };

  return (
    <div>
      <div className="summary-bar">
        <div className="summary-stat">
          <div className="summary-stat__value">{activePlayers.length}</div>
          <div className="summary-stat__label">Active</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat__value">
            {formatCurrency(totalPot, game.currency)}
          </div>
          <div className="summary-stat__label">Total In</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat__value">
            {formatCurrency(totalCashedOut, game.currency)}
          </div>
          <div className="summary-stat__label">Cashed Out</div>
        </div>
      </div>

      <div className="card">
        <div className="card__title">🟢 Active Players</div>

        {activePlayers.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__text">All players have cashed out.</p>
          </div>
        ) : (
          activePlayers.map((player, index) => (
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
                <div className="player-row__stats">
                  In: {formatCurrency(player.totalIn, game.currency)}
                  {player.rebuys.length > 0 && (
                    <span>
                      {' '}
                      · {player.rebuys.length} rebuy
                      {player.rebuys.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="player-row__actions">
                <button
                  className="btn btn--secondary btn--small"
                  onClick={() => setRebuyModalPlayer(player)}
                  title="Add rebuy"
                >
                  + Rebuy
                </button>
                <button
                  className="btn btn--danger btn--small"
                  onClick={() => {
                    setCashoutModalPlayer(player);
                    setCashoutAmount('');
                  }}
                  title="Cash out"
                >
                  Out
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {cashedOutPlayers.length > 0 && (
        <div className="card">
          <div className="card__title">🔴 Cashed Out</div>
          {cashedOutPlayers.map((player) => (
            <div key={player.id} className="player-row" style={{ opacity: 0.6 }}>
              <div className="player-row__avatar">
                {getInitials(player.name)}
              </div>
              <div className="player-row__info">
                <div className="player-row__name">{player.name}</div>
                <div className="player-row__stats">
                  In: {formatCurrency(player.totalIn, game.currency)} · Out:{' '}
                  {formatCurrency(player.cashOut, game.currency)}
                </div>
              </div>
              <div>
                {player.cashOut > player.totalIn ? (
                  <span className="chip chip--green">
                    +{formatCurrency(player.cashOut - player.totalIn, game.currency)}
                  </span>
                ) : player.cashOut < player.totalIn ? (
                  <span className="chip chip--red">
                    -{formatCurrency(player.totalIn - player.cashOut, game.currency)}
                  </span>
                ) : (
                  <span className="chip chip--gold">Even</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button
          className="btn btn--secondary btn--full"
          onClick={() => setShowAddPlayer(true)}
        >
          + Add Player
        </button>
        <button
          className="btn btn--primary btn--full"
          onClick={handleEndGame}
          style={{ fontSize: '0.9rem' }}
        >
          🏁 End Game
        </button>
      </div>

      {showAddPlayer && (
        <div className="modal-overlay" onClick={() => setShowAddPlayer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Add New Player</h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              New player will buy in for{' '}
              {formatCurrency(game.buyIn, game.currency)}
            </p>
            <form onSubmit={handleAddPlayer}>
              <div className="input-group">
                <label className="input-group__label">Player Name</label>
                <input
                  type="text"
                  className="input-group__field"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Enter name..."
                  autoFocus
                />
              </div>
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setShowAddPlayer(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!newPlayerName.trim()}
                >
                  Add Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rebuyModalPlayer && (
        <div
          className="modal-overlay"
          onClick={() => setRebuyModalPlayer(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">
              Rebuy — {rebuyModalPlayer.name}
            </h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              Currently in for{' '}
              {formatCurrency(rebuyModalPlayer.totalIn, game.currency)}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
              }}
            >
              {REBUY_OPTIONS.map((amount) => (
                <button
                  key={amount}
                  className="btn btn--secondary"
                  onClick={() => handleRebuy(amount)}
                  style={{ padding: '14px', fontSize: '1rem' }}
                >
                  {formatCurrency(amount, game.currency)}
                </button>
              ))}
            </div>
            <div className="divider" />
            <button
              className="btn btn--secondary btn--full"
              onClick={() => setRebuyModalPlayer(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {cashoutModalPlayer && (
        <div
          className="modal-overlay"
          onClick={() => setCashoutModalPlayer(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">
              Cash Out — {cashoutModalPlayer.name}
            </h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              Total invested:{' '}
              {formatCurrency(cashoutModalPlayer.totalIn, game.currency)}
              <br />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Chip value: {formatCurrency(game.buyIn / game.chipsPerBuyIn, game.currency)} per chip
              </span>
            </p>
            <div className="input-group">
              <label className="input-group__label">Number of Chips</label>
              <input
                type="number"
                className="input-group__field"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(e.target.value)}
                placeholder="How many chips?"
                min="0"
                autoFocus
              />
              {cashoutAmount && !isNaN(Number(cashoutAmount)) && (
                <p style={{ color: 'var(--gold)', fontSize: '0.85rem', marginTop: '8px', textAlign: 'center' }}>
                  = {formatCurrency(Number(cashoutAmount) * (game.buyIn / game.chipsPerBuyIn), game.currency)}
                </p>
              )}
            </div>
            <div className="modal__actions">
              <button
                className="btn btn--danger"
                onClick={() => setCashoutModalPlayer(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  const chips = Number(cashoutAmount);
                  if (isNaN(chips) || chips < 0) {
                    alert('Please enter a valid number of chips.');
                    return;
                  }
                  dispatch({
                    type: 'CASH_OUT_PLAYER',
                    payload: { playerId: cashoutModalPlayer.id, chips },
                  });
                  setCashoutModalPlayer(null);
                  setCashoutAmount('');
                }}
                disabled={cashoutAmount === ''}
              >
                Cash Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}