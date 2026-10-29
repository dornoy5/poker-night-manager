import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { googleLogin, phoneRegister, phoneLogin } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const LAST_PHONE_KEY = 'lastPhone';

export default function LoginScreen() {
  const { login } = useAuth();
  const showToast = useToast();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Someone who signed in on this phone before most likely has an account
  const lastPhone = localStorage.getItem(LAST_PHONE_KEY) || '';
  const [mode, setMode] = useState(lastPhone ? 'signin' : 'new'); // 'new' | 'signin'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(lastPhone);
  const [pin, setPin] = useState('');

  const joining = !!localStorage.getItem('pendingJoin');

  const finish = (data) => {
    if (!data?.token) {
      setError(data?.error || 'Something went wrong. Try again.');
      return;
    }
    localStorage.setItem(LAST_PHONE_KEY, phone.trim());
    if (data.pinWasReset) showToast('New PIN saved. Use it next time.', 'success');
    login(data.token, data.user);
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'new' && !name.trim()) return setError('Enter your name, so your friends know who you are.');
    if (!phone.trim()) return setError('Enter your phone number.');
    if (!/^\d{4}$/.test(pin)) return setError('Your PIN is exactly 4 digits.');
    setBusy(true);
    try {
      finish(mode === 'new' ? await phoneRegister(name.trim(), phone.trim(), pin) : await phoneLogin(phone.trim(), pin));
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async (credentialResponse) => {
    setError('');
    try {
      const data = await googleLogin(credentialResponse.credential);
      if (data.token) login(data.token, data.user);
      else setError('Google sign-in failed. Try again, or use your phone number.');
    } catch {
      setError('Google sign-in failed. Try again, or use your phone number.');
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setPin('');
  };

  return (
    <div className="app login">
      {/* A tossed stack of chips: the app's whole subject in one picture */}
      <div className="login__stack" aria-hidden="true">
        <span className="login__chip" style={{ '--chip': 'var(--chip-blue)', '--x': '-34px', '--y': '18px', '--r': '-14deg' }} />
        <span className="login__chip" style={{ '--chip': 'var(--chip-coral)', '--x': '30px', '--y': '6px', '--r': '12deg' }} />
        <span className="login__chip login__chip--top" style={{ '--chip': 'var(--chip-yellow)', '--x': '0px', '--y': '-14px', '--r': '0deg' }} />
      </div>

      <h1 className="login__title">Poker night,<br />sorted.</h1>
      {/* From an invite link, get straight to the form */}
      {joining ? (
        <p className="login__note">You're invited to a poker group. Fill this in and you're in.</p>
      ) : (
        <p className="login__lead">
          Buy-ins, rebuys and who pays whom at the end. One phone runs the table, everyone else follows live.
        </p>
      )}

      <form className="card login__form" onSubmit={handlePhoneSubmit} noValidate>
        <div className="segmented" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === 'new'} className={mode === 'new' ? 'is-on' : ''} onClick={() => switchMode('new')}>
            New here
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-on' : ''} onClick={() => switchMode('signin')}>
            I have an account
          </button>
        </div>

        {mode === 'new' && (
          <div className="input-group">
            <label className="input-group__label" htmlFor="login-name">Your name</label>
            <input
              id="login-name"
              className="input-group__field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={40}
              placeholder="How your friends know you"
            />
          </div>
        )}

        <div className="input-group">
          <label className="input-group__label" htmlFor="login-phone">Phone number</label>
          <input
            id="login-phone"
            className="input-group__field"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="050-123-4567"
          />
        </div>

        <div className="input-group">
          <label className="input-group__label" htmlFor="login-pin">{mode === 'new' ? 'Pick a 4-digit PIN' : 'Your 4-digit PIN'}</label>
          <input
            id="login-pin"
            className="input-group__field login__pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
          />
          <p className="input-group__hint">
            {mode === 'new'
              ? "You'll only need it to sign in on a new phone."
              : 'Forgot it? Ask your group manager to reset it, then type a new one here.'}
          </p>
        </div>

        {error && <p className="login__error" role="alert">{error}</p>}

        <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
          {busy ? 'One sec…' : mode === 'new' ? (joining ? 'Join the group' : 'Create my account') : 'Sign in'}
        </button>
      </form>

      <div className="login__or"><span>or</span></div>

      <div className="login__action">
        <GoogleLogin
          onSuccess={handleGoogle}
          onError={() => setError('Google sign-in failed. Try again, or use your phone number.')}
          theme="filled_black"
          size="large"
          shape="pill"
          text="signin_with"
        />
      </div>
      <p className="login__fine">Only people in your group can see your games. Your number is never shown to anyone.</p>
      <p className="login__fine" style={{ marginTop: '8px' }}>
        <a href="/guide.html" style={{ color: 'var(--gold)', fontWeight: 600 }}>How it works (מדריך בעברית)</a>
      </p>
    </div>
  );
}
