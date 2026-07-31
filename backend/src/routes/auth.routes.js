'use strict';

const express = require('express');
const c = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth');
const createRateLimiter = require('../middlewares/rateLimit');

const router = express.Router();

/** /api/v1/auth/* */

// Login is the brute-force target, so it gets the tighter limit.
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many accounts created from this address. Please try again later.',
});

router.post('/register', registerLimiter, c.register);
router.post('/login', loginLimiter, c.login);

// Requires a valid token — this is how the frontend restores a session on load.
router.get('/me', requireAuth, c.me);
router.patch('/preferences', requireAuth, c.updatePreferences);

module.exports = router;
