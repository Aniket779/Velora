const mongoose = require('mongoose');
const { printConnectionHelp } = require('./dbErrors');

/**
 * ============================================================================
 * MONGODB CONNECTION
 * ============================================================================
 * Exits the process on failure rather than limping on. A server that accepts
 * requests without a database returns 500s that look like application bugs;
 * exiting makes the real cause obvious, and Render restarts the container.
 * ============================================================================
 */
const connectDB = async () => {
  const mongoUri =
    process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Velora';

  try {
    await mongoose.connect(mongoUri, {
      // Default is 30s. Ten is long enough for a cold Atlas cluster and short
      // enough that a misconfiguration surfaces while you're still watching
      // the deploy log.
      serverSelectionTimeoutMS: 10_000,
    });

    // Never log the URI itself — it contains the password.
    console.log(`[DB] Connected to ${mongoose.connection.name}`);
  } catch (error) {
    console.error(`[DB] Connection failed: ${error.message}`);

    printConnectionHelp(error.message);
    process.exit(1);
  }

  // A connection that drops AFTER startup doesn't re-enter the catch above.
  // Without this listener the failure is silent and every query just hangs.
  mongoose.connection.on('error', (err) => {
    console.error(`[DB] Connection error after startup: ${err.message}`);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] Disconnected — the driver will attempt to reconnect');
  });
};

module.exports = connectDB;
