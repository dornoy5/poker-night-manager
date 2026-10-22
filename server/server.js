const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { JWT_SECRET, isMemberOf } = require('./middleware/auth');
const Group = require('./models/Group');
const Game = require('./models/Game');

const app = express();
const httpServer = http.createServer(app);

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

function registerUser(socket, token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    if (!userSocketMap.has(socket.userId)) userSocketMap.set(socket.userId, new Set());
    userSocketMap.get(socket.userId).add(socket.id);
  } catch (err) {
    // Invalid token: the socket stays anonymous and cannot join any room
  }
}

// The client sends its login token in the handshake, so every (re)connect is authenticated
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) registerUser(socket, token);
  next();
});

io.on('connection', (socket) => {
  // Older clients authenticate with an event instead of the handshake
  socket.on('authenticate', (token) => {
    if (!socket.userId) registerUser(socket, token);
  });

  // Join a group room (members only)
  socket.on('join-group', async (groupId) => {
    try {
      if (!groupId || !socket.userId) return;
      const group = await Group.findById(groupId);
      if (group && isMemberOf(group, socket.userId)) socket.join(`group:${groupId}`);
    } catch (err) {
      // Bad id: ignore
    }
  });

  // Join a game room (its creator or members of its group only)
  socket.on('join-game', async (gameId) => {
    try {
      if (!gameId || !socket.userId) return;
      const game = await Game.findById(gameId);
      if (!game) return;
      let allowed = game.createdBy && game.createdBy.toString() === socket.userId;
      if (!allowed && game.groupId) {
        const group = await Group.findById(game.groupId);
        allowed = !!group && isMemberOf(group, socket.userId);
      }
      if (allowed) socket.join(gameId);
    } catch (err) {
      // Bad id: ignore
    }
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
