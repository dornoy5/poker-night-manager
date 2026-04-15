import { useState } from 'react';
import { useGame, useGameDispatch } from '../context/GameContext';
import { useToast } from '../context/ToastContext';
import { getInitials, formatCurrency } from '../utils/helpers';

export default function SetupScreen({ group, runningGame }) {
  const game = useGame();
  const dispatch = useGameDispatch();
  const showToast = useToast();

  // Track selected member IDs
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Guest name input
  const [guestName, setGuestName] = useState('');
  // Extra guests added (by name only)
  const [guests, setGuests] = useState([]);
  // Running game conflict warning
  const [conflictPlayers, setConflictPlayers] = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const chipValue = game.chipsPerBuyIn > 0 ? game.buyIn / game.chipsPerBuyIn : 0;

  const toggleMember = (member) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(member._id)) {
        next.delete(member._id);
      } else {
        next.add(member._id);
      }
      return next;
    });
  };

  const handleAddGuest = (e) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;

    const allNames = [
      ...(group?.members || [])
        .filter((m) => selectedIds.has(m._id))
        .map((m) => m.name.toLowerCase()),
      ...guests.map((g) => g.toLowerCase()),
    ];

    if (allNames.includes(name.toLowerCase())) {
      showToast('Player already added!', 'error');
      return;
    }
    setGuests((prev) => [...prev, name]);
    setGuestName('');
  };

  const removeGuest = (name) => {
    setGuests((prev) => prev.filter((g) => g !== name));
  };

  const totalPlayers = selectedIds.size + guests.length;

  const doStartGame = () => {
    const members = group?.members || [];
    members
      .filter((m) => selectedIds.has(m._id))
      .forEach((m) => {
        dispatch({ type: 'ADD_PLAYER', payload: { name: m.name, userId: m._id } });
      });
    guests.forEach((name) => {
      dispatch({ type: 'ADD_PLAYER', payload: { name } });
    });
    dispatch({ type: 'START_GAME' });
  };

  const handleStartGame = () => {
    if (totalPlayers < 2) {
      showToast('You need at least 2 players to start.', 'error');
      return;
    }
    if (!game.buyIn || game.buyIn <= 0) {
      showToast('Please set a valid buy-in amount.', 'error');
      return;
    }
    if (!game.chipsPerBuyIn || game.chipsPerBuyIn <= 0) {
      showToast('Please set how many chips per buy-in.', 'error');
      return;
    }

    // Check if any selected members are already in the running game
    if (runningGame) {
      const runningNames = runningGame.players.map((p) => p.name.toLowerCase());
      const members = group?.members || [];
      const conflicts = [
        ...members.filter((m) => selectedIds.has(m._id) && runningNames.includes(m.name.toLowerCase())).map((m) => m.name),
        ...guests.filter((g) => runningNames.includes(g.toLowerCase())),
      ];
      if (conflicts.length > 0) {
        setConflictPlayers(conflicts);
        setShowConflictModal(true);
        return;
      }
    }

    doStartGame();
  };

  const members = group?.members || [];

  return (
    <div>
      {/* Game Settings */}
      <div className="card">
        <div className="card__title">⚙ Game Settings</div>

        <div className="input-group">
          <label className="input-group__label">Currency</label>
          <div className="select-group">
            <select
              value={game.currency}
              onChange={(e) => dispatch({ type: 'SET_CURRENCY', payload: e.target.value })}
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
            onChange={(e) => dispatch({ type: 'SET_BUYIN', payload: Number(e.target.value) })}
            onBlur={(e) => {
              const rounded = Math.round(Number(e.target.value) / 50) * 50;
              dispatch({ type: 'SET_BUYIN', payload: Math.max(50, rounded) });
            }}
            min="50"
            step="50"
            placeholder="e.g. 100"
          />
          <p className="input-group__hint">Must be a multiple of 50</p>
        </div>

        <div className="input-group">
          <label className="input-group__label">Chips per Buy-in</label>
          <input
            type="number"
            className="input-group__field"
            value={game.chipsPerBuyIn}
            onChange={(e) => dispatch({ type: 'SET_CHIPS_PER_BUYIN', payload: Number(e.target.value) })}
            min="1"
            placeholder="e.g. 200"
          />
          <p className="input-group__hint">How many chips each player gets for the buy-in</p>
        </div>

        {chipValue > 0 && (
          <div style={{ padding: '12px 16px', background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Chip value: </span>
            <strong style={{ color: 'var(--gold)', fontSize: '1rem' }}>{formatCurrency(chipValue, game.currency)} per chip</strong>
          </div>
        )}
      </div>

      {/* Member Selection */}
      <div className="card">
        <div className="card__title">👥 Who's Playing?</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '14px' }}>
          Tap to select group members
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          {members.map((m) => {
            const selected = selectedIds.has(m._id);
            return (
              <button
                key={m._id}
                onClick={() => toggleMember(m)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '24px',
                  border: selected ? '2px solid var(--gold)' : '2px solid rgba(61,122,82,0.25)',
                  background: selected ? 'rgba(212,168,67,0.12)' : 'var(--bg-darkest)',
                  color: selected ? 'var(--gold)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: selected ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {m.picture ? (
                  <img src={m.picture} alt={m.name} style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
                ) : (
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: selected ? 'var(--gold)' : 'var(--felt-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--bg-darkest)', flexShrink: 0 }}>
                    {getInitials(m.name)}
                  </span>
                )}
                {m.name.split(' ')[0]}
                {selected && <span style={{ fontSize: '0.75rem' }}>✓</span>}
              </button>
            );
          })}
        </div>

        {/* Guest input */}
        <div style={{ borderTop: '1px solid rgba(61,122,82,0.15)', paddingTop: '14px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px' }}>
            + Add a guest (not in the group)
          </p>
          <form onSubmit={handleAddGuest} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input-group__field"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name..."
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button type="submit" className="btn btn--secondary" disabled={!guestName.trim()}>
              Add
            </button>
          </form>

          {guests.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {guests.map((name) => (
                <div
                  key={name}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg-dark)', border: '1px solid rgba(61,122,82,0.2)', borderRadius: '20px', fontSize: '0.85rem' }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Guest</span>
                  {name}
                  <button
                    onClick={() => removeGuest(name)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '14px' }}>
          {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} selected
        </p>
      </div>

      <button
        className="btn btn--primary btn--full"
        onClick={handleStartGame}
        disabled={totalPlayers < 2}
        style={{ padding: '16px', fontSize: '1rem' }}
      >
        🎲 Start Game
      </button>

      {showConflictModal && (
        <div className="modal-overlay" onClick={() => setShowConflictModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Players Already in a Game</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '12px' }}>
              The following players are already in a running game:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
              {conflictPlayers.map((name) => (
                <span key={name} className="chip chip--red">{name}</span>
              ))}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginBottom: '20px' }}>
              Starting this game will add them to two games simultaneously. Are you sure?
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" onClick={() => setShowConflictModal(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={() => { setShowConflictModal(false); doStartGame(); }} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                Start Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
