import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getGroupGames } from '../api/gameApi';
import { leaveGroup, deleteGroup, promoteToManager, demoteManager, removeMember } from '../api/authApi';
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

function computePlayerStats(games) {
  const map = {};
  for (const game of games) {
    for (const p of game.players) {
      const profit = (p.cashOut || 0) - p.totalIn;
      if (!map[p.name]) {
        map[p.name] = { name: p.name, gamesPlayed: 0, totalProfit: 0, wins: 0, bestGame: 0, currency: game.currency };
      }
      const s = map[p.name];
      s.gamesPlayed += 1;
      s.totalProfit += profit;
      if (profit > 0) s.wins += 1;
      if (profit > s.bestGame) s.bestGame = profit;
    }
  }
  return Object.values(map).sort((a, b) => b.totalProfit - a.totalProfit);
}

export default function GroupDetailScreen({ group: initialGroup, onBack, onNewGame, onSelectGame, onLeaveGroup, onWatchLive }) {
  const { user } = useAuth();
  const showToast = useToast();
  const [group, setGroup] = useState(initialGroup);
  const [settledGames, setSettledGames] = useState([]);
  const [runningGame, setRunningGame] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRunningGameModal, setShowRunningGameModal] = useState(false);
  const [showManagerPanel, setShowManagerPanel] = useState(false);

  useEffect(() => {
    getGroupGames(group._id)
      .then((data) => {
        if (Array.isArray(data)) {
          setSettledGames(data.filter((g) => g.phase === 'settled'));
          const running = data.find((g) => ['active', 'cashout', 'reviewing'].includes(g.phase));
          setRunningGame(running || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [group._id]);

  const isManager = (group.managers || []).some((m) => (m._id || m).toString() === user._id)
    || group.manager?._id?.toString() === user._id
    || group.manager?.toString() === user._id;

  const handleNewGameClick = () => {
    if (runningGame) {
      setShowRunningGameModal(true);
    } else {
      onNewGame(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteGroup(group._id);
      showToast('Group deleted', 'success');
      onLeaveGroup();
    } catch (err) {
      showToast(err.message || 'Failed to delete group', 'error');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await leaveGroup(group._id);
      showToast('You left the group', 'success');
      onLeaveGroup();
    } catch (err) {
      showToast(err.message || 'Failed to leave group', 'error');
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const handlePromote = async (memberId) => {
    try {
      const updated = await promoteToManager(group._id, memberId);
      setGroup(updated);
      showToast('Member promoted to manager', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to promote', 'error');
    }
  };

  const handleDemote = async (memberId) => {
    try {
      const updated = await demoteManager(group._id, memberId);
      setGroup(updated);
      showToast('Manager demoted', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to demote', 'error');
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      const updated = await removeMember(group._id, memberId);
      setGroup(updated);
      showToast('Member removed', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to remove member', 'error');
    }
  };

  const isMemberManager = (memberId) =>
    (group.managers || []).some((m) => (m._id || m).toString() === memberId.toString())
    || group.manager?._id?.toString() === memberId.toString()
    || group.manager?.toString() === memberId.toString();

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <button className="btn btn--secondary btn--small" onClick={onBack}>← Groups</button>
          {isManager && <span className="chip chip--gold">Manager</span>}
        </div>
        <h1 className="header__logo">Poker Night</h1>
        <p className="header__subtitle">Game Manager</p>
        <div className="header__suits">♠ ♥ ♦ ♣</div>
      </header>

      {/* Running game banner */}
      {runningGame && (
        <div style={{ background: 'rgba(61,122,82,0.15)', border: '1px solid var(--felt-accent)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--success)' }}>🟢 Game in progress</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{runningGame.players.length} players · {formatCurrency(runningGame.players.reduce((s, p) => s + p.totalIn, 0), runningGame.currency)} pot</div>
          </div>
          <button className="btn btn--secondary btn--small" onClick={() => onWatchLive(runningGame)}>
            Watch Live
          </button>
        </div>
      )}

      {/* Group info */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div className="card__title" style={{ marginBottom: 0 }}>🎯 Group</div>
          {isManager && (
            <button className="btn btn--secondary btn--small" onClick={() => setShowManagerPanel(!showManagerPanel)}>
              {showManagerPanel ? 'Done' : '⚙ Manage'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="player-row__avatar" style={{ width: '48px', height: '48px', fontSize: '1rem', background: isManager ? 'linear-gradient(135deg, var(--gold-dim), var(--gold))' : undefined, color: isManager ? 'var(--bg-darkest)' : undefined }}>
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

        {/* Member list — normal view */}
        {!showManagerPanel && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
            {group.members.map((m) => (
              <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-darkest)', border: '1px solid rgba(61,122,82,0.2)', borderRadius: '20px', padding: '4px 10px', fontSize: '0.8rem' }}>
                {m.picture ? (
                  <img src={m.picture} alt={m.name} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                ) : (
                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--felt-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
                    {getInitials(m.name)}
                  </span>
                )}
                {m.name.split(' ')[0]}
                {isMemberManager(m._id) && <span style={{ color: 'var(--gold)', fontSize: '0.65rem' }}>★</span>}
              </div>
            ))}
          </div>
        )}

        {/* Manager panel */}
        {showManagerPanel && (
          <div style={{ marginTop: '14px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Members</p>
            {group.members.map((m) => {
              const memberIsManager = isMemberManager(m._id);
              const isSelf = m._id === user._id;
              return (
                <div key={m._id} className="player-row" style={{ marginBottom: '6px' }}>
                  <div className="player-row__avatar" style={{ background: memberIsManager ? 'linear-gradient(135deg, var(--gold-dim), var(--gold))' : undefined, color: memberIsManager ? 'var(--bg-darkest)' : undefined }}>
                    {getInitials(m.name)}
                  </div>
                  <div className="player-row__info">
                    <div className="player-row__name">
                      {m.name.split(' ')[0]}
                      {isSelf && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> (you)</span>}
                    </div>
                    <div className="player-row__stats">{memberIsManager ? '★ Manager' : 'Member'}</div>
                  </div>
                  {!isSelf && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {memberIsManager ? (
                        <button className="btn btn--secondary btn--small" onClick={() => handleDemote(m._id)} style={{ fontSize: '0.72rem' }}>
                          Demote
                        </button>
                      ) : (
                        <button className="btn btn--secondary btn--small" onClick={() => handlePromote(m._id)} style={{ fontSize: '0.72rem', color: 'var(--gold)', borderColor: 'var(--gold)' }}>
                          + Manager
                        </button>
                      )}
                      <button className="btn btn--small" onClick={() => handleRemoveMember(m._id)} style={{ fontSize: '0.72rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New game CTA */}
      <button className="btn btn--primary btn--full" onClick={handleNewGameClick} style={{ padding: '16px', fontSize: '1rem', marginBottom: '16px' }}>
        🎲 New Game
      </button>

      {/* Leave group */}
      <button className="btn btn--secondary btn--full" onClick={() => setShowLeaveConfirm(true)} style={{ marginBottom: '16px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
        Leave Group
      </button>

      {/* Delete group — managers only */}
      {isManager && (
        <button className="btn btn--secondary btn--full" onClick={() => setShowDeleteConfirm(true)} style={{ marginBottom: '16px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
          Delete Group
        </button>
      )}

      {/* Game history */}
      <div className="card">
        <div className="card__title">📜 Game History</div>
        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading...</p>
        ) : settledGames.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🃏</div>
            <p className="empty-state__text">No completed games yet. Start your first game!</p>
          </div>
        ) : (
          settledGames.map((game, index) => {
            const winner = getWinner(game.players);
            const totalPot = game.players.reduce((s, p) => s + p.totalIn, 0);
            return (
              <div key={game._id} className="player-row animate-in" style={{ animationDelay: `${index * 40}ms`, cursor: 'pointer' }} onClick={() => onSelectGame(game)}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--bg-dark)', border: '1px solid rgba(61,122,82,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🃏</div>
                <div className="player-row__info">
                  <div className="player-row__name">{formatDate(game.createdAt)}</div>
                  <div className="player-row__stats">
                    {game.players.length} players · Pot: {formatCurrency(totalPot, game.currency)}
                    {winner && ` · 👑 ${winner.name}`}
                  </div>
                </div>
                {winner && winner.profit > 0 && (
                  <span className="chip chip--green">+{formatCurrency(winner.profit, game.currency)}</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Player Stats */}
      {!loading && settledGames.length > 0 && (() => {
        const stats = computePlayerStats(settledGames);
        const currency = settledGames[0].currency;
        return (
          <div className="card">
            <div className="card__title">📊 Player Stats</div>
            {stats.map((s, index) => (
              <div key={s.name} className="player-row animate-in" style={{ animationDelay: `${index * 40}ms` }}>
                <div style={{ width: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {index === 0 ? '👑' : `#${index + 1}`}
                </div>
                <div className="player-row__avatar">{getInitials(s.name)}</div>
                <div className="player-row__info">
                  <div className="player-row__name">{s.name}</div>
                  <div className="player-row__stats">
                    {s.gamesPlayed} game{s.gamesPlayed !== 1 ? 's' : ''} · {Math.round((s.wins / s.gamesPlayed) * 100)}% win rate
                    {s.bestGame > 0 && ` · Best: +${formatCurrency(s.bestGame, currency)}`}
                  </div>
                </div>
                <span className={`chip ${s.totalProfit > 0 ? 'chip--green' : s.totalProfit < 0 ? 'chip--red' : 'chip--gold'}`}>
                  {s.totalProfit > 0 ? '+' : ''}{formatCurrency(s.totalProfit, currency)}
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Running game conflict modal */}
      {showRunningGameModal && (
        <div className="modal-overlay" onClick={() => setShowRunningGameModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Game Already Running</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '20px' }}>
              There's already a game in progress in <strong>{group.name}</strong> with {runningGame.players.length} players. What would you like to do?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn--primary" onClick={() => { setShowRunningGameModal(false); onWatchLive(runningGame); }}>
                👁 Watch Live
              </button>
              <button className="btn btn--secondary" onClick={() => { setShowRunningGameModal(false); onNewGame(runningGame); }} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                + Create New Game Anyway
              </button>
              <button className="btn btn--secondary" onClick={() => setShowRunningGameModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Delete Group?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '20px' }}>
              <strong>{group.name}</strong> and all its game history will be permanently deleted. This cannot be undone.
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
              <button className="btn btn--primary" onClick={handleDelete} disabled={deleting} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="modal-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Leave Group?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '20px' }}>
              You'll be removed from <strong>{group.name}</strong>. You can rejoin later with the group code.
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" onClick={() => setShowLeaveConfirm(false)} disabled={leaving}>Cancel</button>
              <button className="btn btn--primary" onClick={handleLeave} disabled={leaving} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                {leaving ? 'Leaving...' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
