import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { googleLogin } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleSuccess = async (credentialResponse) => {
    setError('');
    try {
      const data = await googleLogin(credentialResponse.credential);
      if (data.token) {
        login(data.token, data.user);
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  const joining = !!localStorage.getItem('pendingJoin');

  return (
    <div className="app login">
      {/* A tossed stack of chips: the app's whole subject in one picture */}
      <div className="login__stack" aria-hidden="true">
        <span className="login__chip" style={{ '--chip': 'var(--chip-blue)', '--x': '-34px', '--y': '18px', '--r': '-14deg' }} />
        <span className="login__chip" style={{ '--chip': 'var(--chip-coral)', '--x': '30px', '--y': '6px', '--r': '12deg' }} />
        <span className="login__chip login__chip--top" style={{ '--chip': 'var(--chip-yellow)', '--x': '0px', '--y': '-14px', '--r': '0deg' }} />
      </div>

      <h1 className="login__title">Poker night,<br />sorted.</h1>
      <p className="login__lead">
        Buy-ins, rebuys and who pays whom at the end. One phone runs the table, everyone else follows live.
      </p>

      {joining && (
        <p className="login__note">Sign in and you'll join the group right away.</p>
      )}

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.95rem', marginBottom: '16px' }}>
          {error}
        </p>
      )}

      <div className="login__action">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError('Login failed. Please try again.')}
            theme="filled_black"
            size="large"
            shape="pill"
            text="signin_with"
          />
      </div>
      <p className="login__fine">Only people in your group can see your games.</p>
    </div>
  );
}
