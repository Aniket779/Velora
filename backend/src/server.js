const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const { initializeSocket } = require('./socket');
const connectDB = require('./config/db');
const tripRoutes = require('./api/routes/trip.routes');
const errorHandler = require('./api/middlewares/errorHandler');
const QueueListenerService = require('./services/queueListener.service');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'velora-backend' });
});

// Mount Routes
app.use('/api/v1/trips', tripRoutes);

// Unhandled Route Middleware
app.all('*', (req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Global Error Handler Middleware
app.use(errorHandler);

// Database connection
connectDB();

// Initialize Socket.io
initializeSocket(io);

// Initialize Queue Listener to bridge BullMQ to Socket.io
new QueueListenerService(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
