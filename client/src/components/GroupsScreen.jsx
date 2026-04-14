import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getGroups, createGroup, joinGroup } from '../api/authApi';
import { getInitials } from '../utils/helpers';

export default function GroupsScreen({ onSelectGroup }) {
    const { user, logout } = useAuth();
    const showToast = useToast();
    const [groups, setGroups] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        setLoadError(false);
        try {
            const data = await getGroups();
            if (Array.isArray(data)) {
                setGroups(data);
            } else {
                setLoadError(true);
            }
        } catch (err) {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) return;
        try {
            const group = await createGroup(groupName.trim());
            setGroups([group, ...groups]);
            setGroupName('');
            setShowCreate(false);
            showToast('Group created!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to create group', 'error');
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        try {
            const group = await joinGroup(joinCode.trim());
            if (group._id) {
                setGroups([group, ...groups]);
                setJoinCode('');
                setShowJoin(false);
                showToast('Joined group!', 'success');
            } else {
                showToast(group.error || 'Group not found', 'error');
            }
        } catch (err) {
            showToast('Failed to join group', 'error');
        }
    };

    return (
        <div className="app">
            <header className="header">
                <h1 className="header__logo">Poker Night</h1>
                <p className="header__subtitle">Game Manager</p>
                <div className="header__suits">♠ ♥ ♦ ♣</div>
            </header>

            <div
                className="card"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px 20px',
                }}
            >
                {user.picture ? (
                    <img
                        src={user.picture}
                        alt={user.name}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '2px solid var(--gold-dim)',
                        }}
                    />
                ) : (
                    <div className="player-row__avatar">{getInitials(user.name)}</div>
                )}
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {user.email}
                    </div>
                </div>
                <button className="btn btn--secondary btn--small" onClick={logout}>
                    Log out
                </button>
            </div>

            <div className="card">
                <div className="card__title">🎯 Your Groups</div>

                {loading ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                        Loading...
                    </p>
                ) : loadError ? (
                    <div className="empty-state">
                        <div className="empty-state__icon">⚠️</div>
                        <p className="empty-state__text">Failed to load groups.</p>
                        <button
                            className="btn btn--secondary btn--small"
                            style={{ marginTop: '12px' }}
                            onClick={() => { setLoading(true); loadGroups(); }}
                        >
                            Try again
                        </button>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state__icon">👥</div>
                        <p className="empty-state__text">
                            No groups yet. Create one or join with a code from a friend.
                        </p>
                    </div>
                ) : (
                    groups.map((group, index) => (
                        <div
                            key={group._id}
                            className="player-row animate-in"
                            style={{
                                animationDelay: `${index * 50}ms`,
                                cursor: 'pointer',
                            }}
                            onClick={() => onSelectGroup(group)}
                        >
                            <div
                                className="player-row__avatar"
                                style={{
                                    background:
                                        group.manager._id === user._id
                                            ? 'linear-gradient(135deg, var(--gold-dim), var(--gold))'
                                            : undefined,
                                    color:
                                        group.manager._id === user._id
                                            ? 'var(--bg-darkest)'
                                            : undefined,
                                }}
                            >
                                {getInitials(group.name)}
                            </div>
                            <div className="player-row__info">
                                <div className="player-row__name">{group.name}</div>
                                <div className="player-row__stats">
                                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                                    {group.manager._id === user._id && ' · You manage'}
                                    {' · Code: '}
                                    <strong style={{ color: 'var(--gold)' }}>{group.code}</strong>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                                <button
                                    className="btn btn--small"
                                    style={{
                                        background: '#25D366',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 10px',
                                        fontSize: '0.75rem',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const message = `Join my poker group "${group.name}" on Poker Night Manager!\n\nGroup code: ${group.code}\n\nhttps://poker-night-manager-ten.vercel.app`;
                                        window.open(
                                            `https://wa.me/?text=${encodeURIComponent(message)}`,
                                            '_blank'
                                        );
                                    }}
                                    title="Share via WhatsApp"
                                >
                                    Share
                                </button>
                                <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>→</div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button
                    className="btn btn--primary btn--full"
                    onClick={() => setShowCreate(true)}
                >
                    + Create Group
                </button>
                <button
                    className="btn btn--secondary btn--full"
                    onClick={() => setShowJoin(true)}
                >
                    Join Group
                </button>
            </div>

            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal__title">Create a Group</h3>
                        <form onSubmit={handleCreate}>
                            <div className="input-group">
                                <label className="input-group__label">Group Name</label>
                                <input
                                    type="text"
                                    className="input-group__field"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="e.g. Thursday Night Poker"
                                    autoFocus
                                />
                            </div>
                            <div className="modal__actions">
                                <button
                                    type="button"
                                    className="btn btn--secondary"
                                    onClick={() => setShowCreate(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn--primary"
                                    disabled={!groupName.trim()}
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showJoin && (
                <div className="modal-overlay" onClick={() => setShowJoin(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal__title">Join a Group</h3>
                        <p
                            style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.85rem',
                                marginBottom: '16px',
                                textAlign: 'center',
                            }}
                        >
                            Ask the group manager for the 6-letter code
                        </p>
                        <form onSubmit={handleJoin}>
                            <div className="input-group">
                                <label className="input-group__label">Group Code</label>
                                <input
                                    type="text"
                                    className="input-group__field"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. POKER1"
                                    maxLength={6}
                                    autoFocus
                                    style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem' }}
                                />
                            </div>
                            <div className="modal__actions">
                                <button
                                    type="button"
                                    className="btn btn--secondary"
                                    onClick={() => setShowJoin(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn--primary"
                                    disabled={joinCode.length < 6}
                                >
                                    Join
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}