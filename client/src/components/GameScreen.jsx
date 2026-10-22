import { useState, useEffect } from 'react';
import { useGame, useGameDispatch, useSaveStatus } from '../context/GameContext';
import { useToast } from '../context/ToastContext';
import { getGroup } from '../api/authApi';
import { formatCurrency, getInitials } from '../utils/helpers';

export function SaveStatusBanner() {
  const status = useSaveStatus();
  if (status !== 'offline') return null;
  return (
    <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
      ⚠ No connection. Keep going: your changes are kept on this phone and saved when you're back online.
    </div>
  );
}

function getRebuyOptions(buyIn) {
  // Generate 6 options: x1, x1.5, x2, x2.5, x3, x4 of the buy-in amount
  const multipliers = [1, 1.5, 2, 2.5, 3, 4];
  return multipliers.map((m) => Math.round(buyIn * m));
}

export default function GameScreen({ group }) {
  const game = useGame();
  const dispatch = useGameDispatch();
  const showToast = useToast();

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [rebuyPlayerId, setRebuyPlayerId] = useState(null);
  const [customRebuy, setCustomRebuy] = useState('');
  const [cashoutModalPlayer, setCashoutModalPlayer] = useState(null);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [backInPlayer, setBackInPlayer] = useState(null);
  const [members, setMembers] = useState(group?.members || []);

  // Always read the live player, so the modal shows the new total right after an undo
  const rebuyModalPlayer = game.players.find((p) => p.id === rebuyPlayerId) || null;

  // The group passed in may be just { _id, name } (e.g. opened from a notification)
  useEffect(() => {
    if (group?.members || !game.groupId) return;
    getGroup(game.groupId).then((g) => setMembers(g.members || [])).catch(() => {});
  }, [group?.members, game.groupId]);

  const membersNotPlaying = members.filter(
    (m) => !game.players.some((p) => (p.userId && p.userId.toString() === m._id) || p.name.toLowerCase() === m.name.toLowerCase())
  );

  const addMember = (member) => {
    dispatch({ type: 'ADD_PLAYER', payload: { name: member.name, userId: member._id } });
    setShowAddPlayer(false);
  };

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
      showToast('Player already in game!', 'error');
      return;
    }
    dispatch({ type: 'ADD_PLAYER', payload: { name } });
    setNewPlayerName('');
    setShowAddPlayer(false);
  };

  const handleRebuy = (amount) => {
    if (!(amount > 0)) {
      showToast('Enter an amount above 0.', 'error');
      return;
    }
    dispatch({
      type: 'ADD_REBUY',
      payload: { playerId: rebuyModalPlayer.id, amount },
    });
    showToast(`${rebuyModalPlayer.name}: +${formatCurrency(amount, game.currency)}`);
    setRebuyPlayerId(null);
    setCustomRebuy('');
  };

  const handleUndoRebuy = () => {
    const last = rebuyModalPlayer.rebuys[rebuyModalPlayer.rebuys.length - 1];
    dispatch({ type: 'UNDO_LAST_REBUY', payload: rebuyModalPlayer.id });
    showToast(`Removed ${formatCurrency(last.amount, game.currency)} rebuy from ${rebuyModalPlayer.name}`);
  };

  const handleRemovePlayer = () => {
    dispatch({ type: 'REMOVE_PLAYER', payload: rebuyModalPlayer.id });
    showToast(`${rebuyModalPlayer.name} removed`);
    setRebuyPlayerId(null);
  };

  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const handleEndGame = () => {
    if (activePlayers.length === 0) {
      dispatch({ type: 'FINISH_GAME' });
      return;
    }
    setShowEndConfirm(true);
  };

  const confirmEndGame = () => {
    setShowEndConfirm(false);
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
                  onClick={() => setRebuyPlayerId(player.id)}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn--secondary btn--small"
                  onClick={() => setBackInPlayer(player)}
                  title="Back to the table"
                  style={{ opacity: 1 }}
                >
                  ↩ Back in
                </button>
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
            {membersNotPlaying.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label className="input-group__label">From the group</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {membersNotPlaying.map((m) => (
                    <button key={m._id} type="button" className="btn btn--secondary btn--small" onClick={() => addMember(m)}>
                      + {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={handleAddPlayer}>
              <div className="input-group">
                <label className="input-group__label">{membersNotPlaying.length > 0 ? 'Or a guest' : 'Player Name'}</label>
                <input
                  type="text"
                  className="input-group__field"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Enter name..."
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
          onClick={() => { setRebuyPlayerId(null); setCustomRebuy(''); }}
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
              {getRebuyOptions(game.buyIn).map((amount) => (
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
            <form
              onSubmit={(e) => { e.preventDefault(); handleRebuy(Number(customRebuy)); }}
              style={{ display: 'flex', gap: '8px', marginTop: '10px' }}
            >
              <input
                type="number"
                inputMode="decimal"
                className="input-group__field"
                value={customRebuy}
                onChange={(e) => setCustomRebuy(e.target.value)}
                placeholder="Other amount..."
                min="1"
                aria-label="Other rebuy amount"
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button type="submit" className="btn btn--secondary" disabled={!(Number(customRebuy) > 0)}>
                Add
              </button>
            </form>
            {rebuyModalPlayer.rebuys.length > 0 && (
              <button
                className="btn btn--secondary btn--full"
                onClick={handleUndoRebuy}
                style={{ marginTop: '10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                ↩ Undo last rebuy ({formatCurrency(rebuyModalPlayer.rebuys[rebuyModalPlayer.rebuys.length - 1].amount, game.currency)})
              </button>
            )}
            {rebuyModalPlayer.rebuys.length === 0 && (
              <button
                className="btn btn--secondary btn--full"
                onClick={handleRemovePlayer}
                style={{ marginTop: '10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                Remove {rebuyModalPlayer.name} (added by mistake)
              </button>
            )}
            <div className="divider" />
            <button
              className="btn btn--secondary btn--full"
              onClick={() => { setRebuyPlayerId(null); setCustomRebuy(''); }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {backInPlayer && (
        <div className="modal-overlay" onClick={() => setBackInPlayer(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">{backInPlayer.name} back in?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '20px' }}>
              Their cash-out of {backInPlayer.cashOutChips} chips ({formatCurrency(backInPlayer.cashOut, game.currency)}) is removed and they play on with their chips. Add a rebuy after if they buy more.
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" onClick={() => setBackInPlayer(null)}>Cancel</button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  dispatch({ type: 'UNDO_CASH_OUT', payload: backInPlayer.id });
                  showToast(`${backInPlayer.name} is back at the table`);
                  setBackInPlayer(null);
                }}
              >
                Back in
              </button>
            </div>
          </div>
        </div>
      )}

      {showEndConfirm && (
        <div className="modal-overlay" onClick={() => setShowEndConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">End Game?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginBottom: '8px' }}>
              {activePlayers.length} player{activePlayers.length !== 1 ? 's' : ''} still active.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '4px' }}>
              You'll enter their chip counts on the next screen.
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" onClick={() => setShowEndConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={confirmEndGame}>
                End Game
              </button>
            </div>
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
                    showToast('Please enter a valid number of chips.', 'error');
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