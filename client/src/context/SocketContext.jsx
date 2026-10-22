import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api/authApi';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.PROD
  ? 'https://poker-night-api.onrender.com'
  : 'http://localhost:5000';

const SocketContext = createContext(null);
const SocketStatusContext = createContext(true);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket] = useState(() =>
    io(SOCKET_URL, {
      autoConnect: false,
      // The token is read on every (re)connect, so a phone that drops signal comes back logged in
      auth: (cb) => cb({ token: getToken() }),
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    })
  );
  const [connected, setConnected] = useState(false);

  // Connect on mount, disconnect on unmount (safe under StrictMode's double mount)
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [socket]);

  // Reconnect when the user logs in or out so the server knows who this socket is
  const lastUserId = useRef(user?._id);
  useEffect(() => {
    if (lastUserId.current === user?._id) return;
    lastUserId.current = user?._id;
    socket.disconnect().connect();
  }, [socket, user?._id]);

  // Phones pause sockets in the background; reconnect as soon as the app is visible again
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>
      <SocketStatusContext.Provider value={connected}>
        {children}
      </SocketStatusContext.Provider>
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

export function useSocketConnected() {
  return useContext(SocketStatusContext);
}

/**
 * Stay in a socket room (e.g. 'join-game', gameId) for as long as the component is mounted.
 * Rooms are lost when a connection drops, so this re-joins on every reconnect and calls
 * onReconnect so the screen can fetch whatever it missed while offline.
 */
export function useSocketRoom(joinEvent, leaveEvent, id, onReconnect) {
  const socket = useSocket();
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  });

  useEffect(() => {
    if (!socket || !id) return;
    let firstJoin = true;
    const join = () => {
      socket.emit(joinEvent, id);
      if (!firstJoin) onReconnectRef.current?.();
      firstJoin = false;
    };
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      if (leaveEvent) socket.emit(leaveEvent, id);
    };
  }, [socket, joinEvent, leaveEvent, id]);
}
