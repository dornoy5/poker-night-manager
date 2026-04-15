import { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api/authApi';

const SOCKET_URL = import.meta.env.PROD
  ? 'https://poker-night-api.onrender.com'
  : 'http://localhost:5000';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);

  if (!socketRef.current) {
    socketRef.current = io(SOCKET_URL, {
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }

  useEffect(() => {
    const socket = socketRef.current;

    const authenticate = () => {
      const token = getToken();
      if (token) socket.emit('authenticate', token);
    };

    // Authenticate on connect and reconnect
    socket.on('connect', authenticate);
    socket.on('reconnect', authenticate);

    // Authenticate immediately if already connected
    if (socket.connected) authenticate();

    return () => {
      socket.off('connect', authenticate);
      socket.off('reconnect', authenticate);
    };
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
