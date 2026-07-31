'use strict';

const { verifyToken, tokenFromHeader } = require('../utils/jwt');
const { isGuestId } = require('../constants/socketEvents');
const AppError = require('../utils/AppError');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Who is asking?"
 * ============================================================================
 * Everything downstream reads exactly one value: `req.userId`. That was true
 * before authentication existed, which is why adding auth touches this file
 * and almost nothing else — the 18 places that read req.userId never changed.
 *
 * There are two ways to become a req.userId, and they are NOT equally trusted:
 *
 *   VERIFIED   a valid JWT  ->  req.userId = the account's ObjectId
 *                              req.user   = { userId, name }
 *                              req.isAuthenticated = true
 *
 *   GUEST      an x-user-id header matching `guest_...`
 *                           ->  req.userId = that guest id
 *                              req.isAuthenticated = false
 *
 * The guest path exists so a visitor can search and generate an itinerary
 * without signing up. It cannot be used to reach an account, because a real
 * account id never matches the guest pattern (see GUEST_ID_PATTERN).
 *
 * Two middlewares use this:
 *   optionalAuth  browsing, generation      — guests welcome
 *   requireAuth   save/favorite/book/share  — account required, else 401
 * ============================================================================
 */

/**
 * Resolves identity but never rejects. Attach this globally.
 *
 * A bad or expired token is treated as "not signed in" rather than an error,
 * so an expired session degrades to guest browsing instead of a wall of 401s
 * on every page.
 */
const attachIdentity = (req, _res, next) => {
  const claims = verifyToken(tokenFromHeader(req.get('authorization')));

  if (claims) {
    req.user = claims;
    req.userId = claims.userId;
    req.isAuthenticated = true;
    return next();
  }

  // Not signed in. Fall back to a guest identity if the client supplied a
  // well-formed one. Anything else — including a real-looking ObjectId — is
  // discarded rather than trusted.
  const header = req.get('x-user-id');
  req.user = null;
  req.userId = isGuestId(header) ? header.trim() : null;
  req.isAuthenticated = false;
  next();
};

/** Routes that read or write account-owned data. */
const requireAuth = (req, _res, next) => {
  if (!req.isAuthenticated) {
    // 401, not 403: the client can fix this by signing in. The frontend keys
    // its "please log in" prompt off exactly this status.
    return next(new AppError('Please sign in to continue.', 401));
  }
  next();
};

/**
 * Routes that work for everyone but still need *some* identity to route a
 * result back to the right caller — itinerary generation is the case that
 * matters, since the socket event has to reach one specific browser.
 */
const requireIdentity = (req, _res, next) => {
  if (!req.userId) {
    return next(
      new AppError('A user identity is required. Sign in, or send an x-user-id header.', 400)
    );
  }
  next();
};

module.exports = { attachIdentity, requireAuth, requireIdentity };
