'use strict';

const jwt = require('jsonwebtoken');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Issue and check the token"
 * ============================================================================
 * A JWT is three base64 chunks: header.payload.signature. The payload is NOT
 * encrypted — anyone can read it. What the signature guarantees is that nobody
 * *changed* it, because they don't have JWT_SECRET.
 *
 * So the rule is: never put anything secret in a token, only put things you're
 * happy for the user to read. We put the user id and name. Not the email
 * (that's PII in something the browser stores), not roles we haven't built.
 * ============================================================================
 */

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Fail at boot, not at first login.
 *
 * A missing secret is a config mistake that must be loud. The dangerous
 * alternative is defaulting to a hardcoded string like 'secret' — that ships
 * to production and means anyone who reads your GitHub can forge a token for
 * any account.
 */
const getSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set to a random string of at least 32 characters.\n' +
        'Generate one with:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n' +
        'Then add it to backend/.env as JWT_SECRET=<value>'
    );
  }
  return secret;
};

/** Called once at startup so a bad config surfaces immediately. */
const assertConfigured = () => {
  getSecret();
};

const signToken = (user) =>
  jwt.sign(
    { name: user.name },
    getSecret(),
    {
      subject: user._id.toString(), // `sub` is the standard claim for "who"
      expiresIn: EXPIRES_IN,
      issuer: 'velora',
    }
  );

/**
 * Returns the verified payload, or null if the token is missing, expired,
 * tampered with, or signed by a different secret.
 *
 * Returning null rather than throwing keeps the callers simple: optionalAuth
 * treats null as "guest", requireAuth treats null as 401.
 */
const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null;

  try {
    const payload = jwt.verify(token, getSecret(), { issuer: 'velora' });
    if (!payload?.sub) return null;
    return { userId: String(payload.sub), name: payload.name };
  } catch {
    return null;
  }
};

/** Pulls the token out of `Authorization: Bearer <token>`. */
const tokenFromHeader = (header) => {
  if (typeof header !== 'string') return null;
  const [scheme, value] = header.split(' ');
  if (!/^Bearer$/i.test(scheme || '') || !value) return null;
  return value.trim();
};

module.exports = { signToken, verifyToken, tokenFromHeader, assertConfigured, EXPIRES_IN };
