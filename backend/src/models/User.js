'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "A person with an account"
 * ============================================================================
 * Two lines here do the real security work, and both are worth knowing by
 * name because an interviewer will ask about them:
 *
 *   select: false      passwordHash never comes back from a query unless a
 *                      caller explicitly asks with .select('+passwordHash').
 *                      This means you cannot leak the hash by accident — not
 *                      through res.json(user), not through a spread, not
 *                      through a populate() somewhere else in the codebase.
 *                      Login is the ONE place that opts in.
 *
 *   pre('validate')    hashing happens inside the model, so no route, service
 *                      or seed script can ever write a plaintext password.
 *                      There is no code path around it.
 * ============================================================================
 */

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      // NOTE: no `unique: true` here. Declaring it inline AND via
      // schema.index() below creates the index twice and Mongoose warns about
      // it. Index options live in exactly one place — the same discipline that
      // the shareToken partial-index bug taught us.
      trim: true,
      lowercase: true,
      // Deliberately permissive. Over-strict email regexes reject valid
      // addresses; real validation is "can they receive mail", which we
      // don't do here.
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    preferences: {
      budget: {
        type: String,
        enum: ['budget', 'moderate', 'luxury'],
        default: 'moderate',
      },
      travelStyle: {
        type: [String],
        default: [],
      },
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

/**
 * Assigning `user.password = '...'` stages a plaintext password that the
 * pre-validate hook below turns into a hash. The plaintext is never a real
 * schema field, so it can never be persisted even if the hook were skipped.
 */
userSchema
  .virtual('password')
  .set(function setPassword(plain) {
    this._plainPassword = plain;
  });

/**
 * Hash on validate, NOT on save.
 *
 * Mongoose runs validation before pre('save') hooks. Since passwordHash is
 * `required`, hashing in pre('save') would fail validation on every register
 * with "passwordHash is required" — the hook that sets it hadn't run yet.
 * Hashing in pre('validate') puts the value in place before the check.
 */
userSchema.pre('validate', async function hashPassword(next) {
  if (!this._plainPassword) return next();

  // 12 rounds ≈ 250ms on typical hardware. Slow on purpose: it's what makes a
  // stolen database expensive to crack. Raising it is the standard response to
  // hardware getting faster.
  this.passwordHash = await bcrypt.hash(this._plainPassword, 12);
  this._plainPassword = undefined;
  next();
});

/**
 * bcrypt.compare is constant-time with respect to the hash, so it doesn't leak
 * how much of the password matched via timing.
 */
userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

/** The only shape of a user that is ever allowed to reach a client. */
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    preferences: this.preferences,
    createdAt: this.createdAt,
  };
};

/**
 * The ONE declaration of the email index.
 *
 * This uniqueness constraint is what actually prevents duplicate accounts —
 * not the findOne check in auth.service. Two simultaneous registrations can
 * both pass a check; only the database can arbitrate, which is why the service
 * catches error code 11000 instead of pre-checking.
 *
 * Run `npm run sync-indexes` after changing this. Mongoose creates indexes but
 * never drops old ones.
 */
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
