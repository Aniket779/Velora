'use strict';

const mongoose = require('mongoose');

/**
 * ============================================================================
 * USER ACTIVITY — one collection for favourites and recently-viewed
 * ============================================================================
 * WHY ONE COLLECTION
 * "Favourite a hotel" and "viewed Goa" are the same shape: a user, a thing,
 * a kind, a timestamp. Two collections would mean two models, two services and
 * two sets of endpoints that do the same job. A `kind` discriminator keeps it
 * to one of each.
 *
 * WHY A SNAPSHOT
 * Each row stores a small copy of the thing (name, image, price) alongside the
 * reference. Rendering a favourites list then needs ONE query instead of a
 * populate fan-out across four different collections. The reference is still
 * there when fresh data is needed.
 * ============================================================================
 */

const ACTIVITY_KINDS = ['favorite', 'recently_viewed'];
const REF_TYPES = ['hotel', 'restaurant', 'place', 'flight', 'destination'];

const userActivitySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    kind: { type: String, required: true, enum: ACTIVITY_KINDS },

    refType: { type: String, required: true, enum: REF_TYPES },
    /** Inventory _id, or a citySlug for destinations. */
    refId: { type: String, required: true },

    /** Denormalised copy so a list render is a single query. */
    snapshot: { type: mongoose.Schema.Types.Mixed, default: null },

    /** Bumped on re-view so "recently viewed" ordering stays correct. */
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One row per user+kind+item. Re-favouriting updates rather than duplicating.
userActivitySchema.index({ userId: 1, kind: 1, refType: 1, refId: 1 }, { unique: true });
// The list query: "my favourites, newest first".
userActivitySchema.index({ userId: 1, kind: 1, lastSeenAt: -1 });

module.exports = mongoose.model('UserActivity', userActivitySchema);
module.exports.ACTIVITY_KINDS = ACTIVITY_KINDS;
module.exports.REF_TYPES = REF_TYPES;
