import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { updateProfile, changePin } from '../api/authApi';
import { getInitials, chipStyle, needsRealName } from '../utils/helpers';

const digits = (v) => v.replace(/\D/g, '').slice(0, 4);
const tidy = (v) => v.trim().replace(/\s+/g, ' ');

export default function ProfileScreen({ onBack }) {
  const { user, updateUser, logout } = useAuth();
  const showToast = useToast();
  const askingForName = needsRealName(user);

  const [firstName, setFirstName] = useState(askingForName ? '' : user.firstName || user.name);
  const [lastName, setLastName] = useState(askingForName ? '' : user.lastName || '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [pinError, setPinError] = useState('');

  const fullName = [tidy(firstName), tidy(lastName)].filter(Boolean).join(' ');

  const saveName = async (e) => {
    e.preventDefault();
    const first = tidy(firstName);
    const last = tidy(lastName);
    if (!first) return setNameError('Type your first name.');
    if ((first + last).includes('@')) return setNameError('That looks like an email. Use your name instead.');
    setNameError('');
    setSavingName(true);
    try {
      const saved = await updateProfile(first, last);
      updateUser({ name: saved.name, firstName: saved.firstName, lastName: saved.lastName });
      showToast('Name saved. Your friends see it now.', 'success');
      if (askingForName) onBack();
    } catch (err) {
      setNameError(err.message || 'Could not save your name. Try again.');
    } finally {
      setSavingName(false);
    }
  };

  const savePin = async (e) => {
    e.preventDefault();
    if (currentPin.length !== 4) return setPinError('Type your current 4-digit PIN.');
    if (newPin.length !== 4) return setPinError('The new PIN must be 4 digits.');
    setPinError('');
    setSavingPin(true);
    try {
      await changePin(currentPin, newPin);
      setCurrentPin('');
      setNewPin('');
      showToast('PIN changed. Use the new one next time.', 'success');
    } catch (err) {
      setPinError(err.message || 'Could not change your PIN. Try again.');
    } finally {
      setSavingPin(false);
    }
  };

  const preview = fullName || user.name;

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="btn btn--secondary btn--small" onClick={onBack}>← Groups</button>
        </div>
        <h1 className="header__logo">Poker Night</h1>
      </header>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div className="player-row__avatar" style={{ ...chipStyle(preview), width: '56px', height: '56px', fontSize: '1.05rem' }}>
          {getInitials(preview)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', overflowWrap: 'anywhere' }}>{preview}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', overflowWrap: 'anywhere' }}>
            {user.phoneNumber || user.email}
          </div>
        </div>
      </div>

      <form className="card" onSubmit={saveName} noValidate>
        <div className="card__title">{askingForName ? 'What should your friends call you?' : 'Your name'}</div>
        {askingForName && (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Right now your friends see your email address. Type your real name instead.
          </p>
        )}
        <div className="input-group">
          <label className="input-group__label" htmlFor="profile-first-name">First name</label>
          <input
            id="profile-first-name"
            className="input-group__field"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={30}
            autoComplete="given-name"
            autoCapitalize="words"
            placeholder="e.g. Dor"
            autoFocus={askingForName}
          />
        </div>
        <div className="input-group">
          <label className="input-group__label" htmlFor="profile-last-name">
            Last name <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="profile-last-name"
            className="input-group__field"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={30}
            autoComplete="family-name"
            autoCapitalize="words"
            placeholder="e.g. Cohen"
          />
          <p className="input-group__hint">
            Your group sees "{fullName || 'your name'}" everywhere: groups, the running game, past games and stats.
          </p>
        </div>
        {nameError && <p className="login__error" role="alert">{nameError}</p>}
        <button type="submit" className="btn btn--primary btn--full" disabled={savingName || !fullName || fullName === user.name}>
          {savingName ? 'Saving…' : 'Save name'}
        </button>
      </form>

      {user.authType === 'phone' && (
        <form className="card" onSubmit={savePin} noValidate>
          <div className="card__title">Change your PIN</div>
          <div className="input-group">
            <label className="input-group__label" htmlFor="profile-pin-current">Current PIN</label>
            <input
              id="profile-pin-current"
              className="input-group__field login__pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="current-password"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(digits(e.target.value))}
              placeholder="••••"
            />
          </div>
          <div className="input-group">
            <label className="input-group__label" htmlFor="profile-pin-new">New PIN</label>
            <input
              id="profile-pin-new"
              className="input-group__field login__pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="new-password"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(digits(e.target.value))}
              placeholder="••••"
            />
            <p className="input-group__hint">Forgot your current PIN? Ask your group manager to reset it.</p>
          </div>
          {pinError && <p className="login__error" role="alert">{pinError}</p>}
          <button type="submit" className="btn btn--secondary btn--full" disabled={savingPin}>
            {savingPin ? 'Saving…' : 'Change PIN'}
          </button>
        </form>
      )}

      <button className="btn btn--danger btn--full" onClick={logout} style={{ marginTop: '4px' }}>
        Log out
      </button>
    </div>
  );
}
