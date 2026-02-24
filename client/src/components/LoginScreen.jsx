import { GoogleLogin } from '@react-oauth/google';
import { googleLogin } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();

  const handleSuccess = async (credentialResponse) => {
    try {
      const data = await googleLogin(credentialResponse.credential);
      if (data.token) {
        login(data.token, data.user);
      } else {
        alert('Login failed. Please try again.');
      }
    } catch (err) {
      alert('Login failed. Please try again.');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="header__logo">Poker Night</h1>
        <p className="header__subtitle">Game Manager</p>
        <div className="header__suits">♠ ♥ ♦ ♣</div>
      </header>

      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🃏</div>
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.3rem',
            color: 'var(--gold)',
            marginBottom: '12px',
          }}
        >
          Welcome
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            marginBottom: '32px',
            lineHeight: 1.5,
          }}
        >
          Sign in to manage your poker nights, create groups, and track your stats.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => alert('Login failed')}
            theme="filled_black"
            size="large"
            shape="pill"
            text="signin_with"
          />
        </div>
      </div>
    </div>
  );
}