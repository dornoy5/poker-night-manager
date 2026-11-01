import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('poker-token');
    if (token) {
      getMe()
        .then((data) => {
          if (data._id) {
            setUser(data);
          } else {
            localStorage.removeItem('poker-token');
          }
        })
        .catch(() => {
          localStorage.removeItem('poker-token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('poker-token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('poker-token');
    localStorage.removeItem('activeGameId');
    setUser(null);
  };

  // After a profile change: show the new details everywhere without signing in again
  const updateUser = (changes) => setUser((prev) => (prev ? { ...prev, ...changes } : prev));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}