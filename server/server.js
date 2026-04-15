const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'poker-night-secret-key';

// Allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:4173'];

// CORS for Express
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

// userId -> Set of socketIds
const userSocketMap = new Map();

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  // Authenticate: map userId -> socketId
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;
      socket.userId = userId;

      if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
      userSocketMap.get(userId).add(socket.id);
    } catch (err) {
      // Invalid token — ignore
    }
  });

  // Join a group room
  socket.on('join-group', (groupId) => {
    if (groupId) socket.join(`group:${groupId}`);
  });

  // Join a game room
  socket.on('join-game', (gameId) => {
    if (gameId) socket.join(gameId);
  });

  socket.on('leave-game', (gameId) => {
    if (gameId) socket.leave(gameId);
  });

  socket.on('disconnect', () => {
    if (socket.userId && userSocketMap.has(socket.userId)) {
      userSocketMap.get(socket.userId).delete(socket.id);
      if (userSocketMap.get(socket.userId).size === 0) {
        userSocketMap.delete(socket.userId);
      }
    }
  });
});

// Attach io and userSocketMap to app so routes can use them
app.set('io', io);
app.set('userSocketMap', userSocketMap);

// Routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const playerRoutes = require('./routes/players');
const groupRoutes = require('./routes/groups');

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/groups', groupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Poker Night API is running' });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
