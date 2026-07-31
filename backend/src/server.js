const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { initializeSocket } = require('./socket');
const connectDB = require('./config/db');
const tripRoutes = require('./routes/trip.routes');
const servicesRoutes = require('./routes/services.routes');
const travelRoutes = require('./routes/travel.routes');
const libraryRoutes = require('./routes/library.routes');
const discoverRoutes = require('./routes/discover.routes');
const authRoutes = require('./routes/auth.routes');
const errorHandler = require('./middlewares/errorHandler');
const { attachIdentity } = require('./middlewares/auth');
const { assertConfigured } = require('./utils/jwt');
const { provider: aiProvider } = require('./ai/llm');
const QueueListenerService = require('./services/queueListener.service');

// Fail fast on a missing or weak JWT_SECRET. A config mistake that only shows
// up when the first person tries to log in is far worse than one that stops
// the server starting.
assertConfigured();

/**
 * Which browser origins may call this API.
 *
 * CLIENT_URL takes a comma-separated list, because in practice there are
 * always at least three: local dev, the production Vercel domain, and the
 * per-commit preview URLs Vercel generates. A single hardcoded origin means
 * every preview deploy is silently blocked by CORS, which presents as "the app
 * loads but every request fails" — one of the more annoying things to debug.
 */
const ALLOWED_ORIGINS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOrigin = (origin, callback) => {
  // No Origin header: curl, Postman, health checks, server-to-server. These
  // aren't browser requests, so the same-origin policy isn't in play.
  if (!origin) return callback(null, true);

  const clean = origin.replace(/\/$/, '');
  if (ALLOWED_ORIGINS.includes(clean)) return callback(null, true);

  // Allow this project's own Vercel preview deployments.
  if (process.env.VERCEL_PREVIEW_PATTERN && new RegExp(process.env.VERCEL_PREVIEW_PATTERN).test(clean)) {
    return callback(null, true);
  }

  console.warn(`[CORS] Blocked origin: ${origin}`);
  return callback(new Error(`Origin ${origin} is not allowed by CORS`));
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Socket.io does its own CORS check, entirely separate from Express. Getting
  // one right and forgetting the other means HTTP works while the WebSocket
  // silently falls back to polling and then fails.
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

app.use(
  cors({
    origin: corsOrigin,
    // Authorization must be allow-listed or the browser strips the token from
    // cross-origin requests and every call arrives looking anonymous.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
    exposedHeaders: ['Retry-After'],
  })
);

// A 1MB body is generous for JSON. Without a cap, one large POST can exhaust
// memory before any route handler is reached.
app.use(express.json({ limit: '1mb' }));

// Behind Render/Vercel's proxy, req.ip is the proxy without this — which would
// make the login rate limiter count every user as the same address.
app.set('trust proxy', 1);

// Resolves the caller onto req.userId: a verified JWT if present, otherwise a
// guest id, otherwise null. Never rejects — routes decide what they require.
app.use(attachIdentity);

/**
 * Health check.
 *
 * Render polls this to decide whether the deploy succeeded, and a free-tier
 * keep-alive cron hits it every 10 minutes so the instance never sleeps.
 *
 * It reports Mongo's real connection state rather than a bare `ok`. A server
 * that answers "ok" while its database is unreachable is worse than one that
 * fails outright — the deploy goes green and the errors surface as broken
 * pages for users instead.
 */
app.get('/health', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1; // 1 = connected
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    service: 'velora-backend',
    db: dbReady ? 'connected' : 'disconnected',
    ai: aiProvider || 'not configured',
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api', travelRoutes);
app.use('/api/v1', travelRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/library', libraryRoutes);
app.use('/api/v1/discover', discoverRoutes);

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
const queueListener = new QueueListenerService(io);

// Start Background Workers
// TODO(M10): extract to a dedicated worker process so AI latency stops competing
// with HTTP request handling on this event loop.
const aiWorker = require('./workers/aiGenerator.worker');

// Render injects PORT and requires the app to bind to it. Binding 0.0.0.0 (not
// localhost) is what makes the container reachable from outside.
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Listening on ${PORT} (${process.env.NODE_ENV || 'development'})`);
  console.log(`[Server] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

/**
 * Closing the BullMQ primitives on shutdown matters here specifically: QueueEvents
 * holds a blocking XREAD against Redis, and a worker killed mid-job leaves the job
 * stalled rather than releasing it for retry.
 */
const shutdown = async (signal) => {
  console.log(`[Server] ${signal} received — shutting down`);
  server.close();

  // Render sends SIGTERM and hard-kills after 30 seconds. If a BullMQ close
  // hangs on a dropped Redis connection, exiting on our own terms at 10s keeps
  // shutdown predictable instead of ending in SIGKILL mid-write.
  const timer = setTimeout(() => {
    console.warn('[Server] Shutdown took too long — forcing exit');
    process.exit(0);
  }, 10_000);
  timer.unref();

  await Promise.allSettled([
    aiWorker.close(),
    queueListener.close(),
    mongoose.connection.close(false),
  ]);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
