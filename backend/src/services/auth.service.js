'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Register, sign in, and say who you are"
 * ============================================================================
 * Three operations, and two deliberate security choices worth being able to
 * defend out loud:
 *
 * 1. LOGIN GIVES ONE ERROR FOR TWO FAILURES.
 *    Unknown email and wrong password both return "Invalid email or password."
 *    Saying "no account with that email" turns the login form into a tool for
 *    checking which of a leaked email list has accounts here.
 *
 * 2. LOGIN HASHES EVEN WHEN THE USER DOESN'T EXIST.
 *    If we returned early on an unknown email, that response would come back in
 *    ~1ms while a real email took ~250ms (the bcrypt work). That timing gap
 *    leaks exactly what choice 1 is trying to hide. So we always do the compare.
 * ============================================================================
 */

const MIN_PASSWORD = 8;

/**
 * A throwaway hash to compare against when the email doesn't exist, so the
 * failure path costs the same ~250ms as the success path.
 *
 * GENERATED, not hardcoded, and that matters: bcrypt.compare returns false
 * immediately if the hash is malformed. A hand-written constant with one wrong
 * character would look correct, pass review, and silently do nothing — the
 * unknown-email path would return in ~0ms and leak exactly the information
 * this is here to hide. Deriving it from bcrypt itself makes that impossible.
 */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

const normaliseEmail = (email) => String(email || '').trim().toLowerCase();

class AuthService {
  async register({ email, password, name }) {
    const cleanEmail = normaliseEmail(email);
    const cleanName = String(name || '').trim();

    if (!cleanEmail) throw new AppError('Email is required.', 400);
    if (!cleanName) throw new AppError('Name is required.', 400);
    if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
      throw new AppError(`Password must be at least ${MIN_PASSWORD} characters.`, 400);
    }
    // bcrypt silently truncates at 72 bytes; rejecting is honest.
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new AppError('Password cannot exceed 72 bytes.', 400);
    }

    try {
      // `password` is the virtual — the model hashes it before saving.
      const user = await User.create({ email: cleanEmail, password, name: cleanName });
      return { user: user.toSafeJSON(), token: signToken(user) };
    } catch (err) {
      // Two requests can pass a findOne check at the same time and both try to
      // insert. The unique index is what actually prevents the duplicate, so
      // this is the correct place to handle it — not a pre-check.
      if (err?.code === 11000) {
        throw new AppError('An account with that email already exists.', 409);
      }
      if (err?.name === 'ValidationError') {
        throw new AppError(Object.values(err.errors)[0]?.message || 'Invalid details.', 400);
      }
      throw err;
    }
  }

  async login({ email, password }) {
    const cleanEmail = normaliseEmail(email);

    // passwordHash is `select: false` on the schema, so it has to be asked for
    // explicitly. This is the only query in the codebase that does.
    const user = await User.findOne({ email: cleanEmail }).select('+passwordHash');

    const attempt = String(password || '');
    const matches = user
      ? await user.comparePassword(attempt)
      : await bcrypt.compare(attempt, DUMMY_HASH); // always false, but costs the same

    if (!user || !matches) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Fire and forget — a slow write here shouldn't delay the login response.
    user.lastLoginAt = new Date();
    user.save().catch((e) => console.error(`[Auth] lastLoginAt update failed: ${e.message}`));

    return { user: user.toSafeJSON(), token: signToken(user) };
  }

  /** Resolves the token's subject to a live user, so deleted accounts 401. */
  async me(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('This account no longer exists.', 401);
    return user.toSafeJSON();
  }

  async updatePreferences(userId, preferences = {}) {
    const allowed = {};
    if (preferences.budget) allowed['preferences.budget'] = preferences.budget;
    if (Array.isArray(preferences.travelStyle)) {
      allowed['preferences.travelStyle'] = preferences.travelStyle.slice(0, 10).map(String);
    }
    if (!Object.keys(allowed).length) throw new AppError('Nothing to update.', 400);

    const user = await User.findByIdAndUpdate(userId, { $set: allowed }, {
      new: true,
      runValidators: true,
    });
    if (!user) throw new AppError('This account no longer exists.', 401);
    return user.toSafeJSON();
  }
}

module.exports = new AuthService();
module.exports.MIN_PASSWORD = MIN_PASSWORD;
