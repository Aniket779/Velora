'use strict';

const auth = require('../services/auth.service');

/** Thin HTTP layer — request in, response out. Logic lives in auth.service. */

const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) { next(err); }
};

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

exports.register = wrap(async (req, res) => {
  const { email, password, name } = req.body || {};
  ok(res, await auth.register({ email, password, name }), 201);
});

exports.login = wrap(async (req, res) => {
  const { email, password } = req.body || {};
  ok(res, await auth.login({ email, password }));
});

/**
 * Called on page load to turn a stored token back into a user.
 *
 * This is what makes a refresh keep you signed in — and it's also the check
 * that catches a token whose account was deleted, since the service resolves
 * the id against the database rather than trusting the claim alone.
 */
exports.me = wrap(async (req, res) => {
  ok(res, { user: await auth.me(req.userId) });
});

exports.updatePreferences = wrap(async (req, res) => {
  ok(res, { user: await auth.updatePreferences(req.userId, req.body || {}) });
});
