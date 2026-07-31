'use strict';

const AppError = require('../utils/AppError');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Stop someone guessing passwords"
 * ============================================================================
 * Without this, an attacker can try passwords against /login as fast as the
 * network allows. bcrypt makes each guess cost ~250ms of CPU, which slows them
 * down but also means a few hundred parallel guesses can pin the server — the
 * hashing cost becomes a denial-of-service vector against us.
 *
 * A fixed window per IP: N attempts per window, then 429 until it resets.
 *
 * HONEST LIMITATION, worth saying before an interviewer points it out: this
 * counter lives in this process's memory. Run two instances behind a load
 * balancer and each gets its own allowance. The fix is the same Redis you're
 * already running for BullMQ — a shared INCR with a TTL. Left in memory here
 * because a single instance is the actual deployment.
 * ============================================================================
 */

const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 10, message } = {}) => {
  const hits = new Map(); // ip -> { count, resetAt }

  // Without this the map grows once per unique IP forever, which is a slow
  // memory leak on a public endpoint.
  const sweep = () => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  };
  const timer = setInterval(sweep, windowMs);
  if (timer.unref) timer.unref(); // never hold the process open

  return (req, res, next) => {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(seconds));
      return next(
        new AppError(message || `Too many attempts. Try again in ${seconds} seconds.`, 429)
      );
    }
    next();
  };
};

module.exports = createRateLimiter;
