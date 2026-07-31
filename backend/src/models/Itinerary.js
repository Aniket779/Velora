'use strict';

const mongoose = require('mongoose');
const { ACTIVITY_TYPES } = require('../ai/schemas');

/**
 * Persisted itinerary.
 *
 * Expanded to hold what grounded generation now produces: the traveller profile the
 * plan was built for, per-activity references back to real inventory documents,
 * cost estimates, and the destination briefing.
 *
 * `activity.type` now uses the shared ACTIVITY_TYPES enum imported from the Zod
 * schema, so the AI contract and the database constraint cannot drift apart — they
 * were previously defined independently, with Mongoose leaving the field untyped.
 */

const resolvedRefSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['hotel', 'restaurant', 'place', 'flight'] },
    id: { type: mongoose.Schema.Types.ObjectId },
    name: String,
    image: String,
    rating: Number,
    latitude: Number,
    longitude: Number,
    price: Number,
    address: String,
  },
  { _id: false }
);

const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: { type: String, enum: ACTIVITY_TYPES },
    /** Catalogue code the model selected (H1/R2/P3/F4), null for unreferenced items. */
    ref: { type: String, default: null },
    /** Authoritative data resolved from MongoDB — never model-supplied. */
    resolved: { type: resolvedRefSchema, default: null },
    location_name: String,
    start_time: String,
    end_time: String,
    duration_minutes: Number,
    description: String,
    why_chosen: String,
    estimated_cost_inr: Number,
    booking_required: { type: Boolean, default: false },
    travel_from_previous: String,
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    day_number: { type: Number, required: true },
    date: { type: Date },
    theme: String,
    activities: [activitySchema],
    daily_budget_estimate_inr: Number,
    notes: String,
  },
  { _id: false }
);

const itinerarySchema = new mongoose.Schema(
  {
    // TODO: migrate to ObjectId + ref: 'Trip' when Trip records are created.
    tripId: { type: String, required: true, index: true },

    /**
     * Owner. Everything in the user's library keys off this — Trip History is
     * "all itineraries for this user", Saved Trips is the subset with
     * isSaved: true. Without it, a generated plan belonged to nobody.
     */
    ownerId: { type: String, required: true, index: true },

    /** Explicitly saved by the user (vs. just appearing in history). */
    isSaved: { type: Boolean, default: false },

    /** User-editable label, defaults to the AI's trip_title. */
    title: { type: String, default: null },

    /**
     * Sharing. A null token means private. Generating a token creates an
     * unguessable public URL; clearing it revokes access immediately.
     * `sparse` so the unique index ignores the many private itineraries.
     */
    /**
     * No `default`, and uniqueness is enforced by the partial index declared
     * below — NOT by `unique: true` here.
     *
     * The original declaration was `{ default: null, unique: true, sparse: true }`,
     * which fails on the second unshared trip. A SPARSE index only skips
     * documents where the field is MISSING, but `default: null` puts the field
     * on every document with the value null. So every unshared itinerary
     * indexed the same `null` key and collided:
     *   E11000 duplicate key ... index: shareToken_1 dup key: { shareToken: null }
     *
     * Leaving the field absent until the trip is actually shared is also more
     * honest: absent means "not shared", which is exactly what unshareTrip's
     * `$unset` produces.
     */
    shareToken: { type: String },
    sharedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },

    trip_title: { type: String },
    summary: { type: String },
    destination: { type: String },
    origin: { type: String },

    /** The traveller profile this plan was generated for. */
    profile: { type: mongoose.Schema.Types.Mixed, default: null },

    versionName: { type: String, default: 'AI Original Draft', trim: true },
    isAIOriginal: { type: Boolean, default: true },

    days: [daySchema],

    totalEstimatedCostInr: { type: Number },
    personalisationNotes: [{ type: String }],
    packingReminders: [{ type: String }],

    /** The 18-category briefing, snapshotted at generation time. */
    destinationIntelligence: { type: mongoose.Schema.Types.Mixed, default: null },
    intelligenceMeta: { type: mongoose.Schema.Types.Mixed, default: null },

    travelData: {
      destination: { type: String },
      origin: { type: String },
      destinationInfo: { type: mongoose.Schema.Types.Mixed, default: null },
      hotels: [{ type: mongoose.Schema.Types.Mixed }],
      restaurants: [{ type: mongoose.Schema.Types.Mixed }],
      places: [{ type: mongoose.Schema.Types.Mixed }],
      flights: [{ type: mongoose.Schema.Types.Mixed }],
      selected: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    /** Provenance: model, prompt version, grounding ratio, mock flag, timing. */
    generationMeta: { type: mongoose.Schema.Types.Mixed, default: null },

    /**
     * Packing/prep checklist. Generated from the destination briefing and the
     * traveller profile, then owned by the user — `done` is their state.
     */
    checklist: [{
      _id: false,
      id: String,
      label: String,
      category: String,
      done: { type: Boolean, default: false },
      custom: { type: Boolean, default: false },
    }],
  },
  { timestamps: true }
);

// Library queries: "my trips, newest first" and "my saved trips".
itinerarySchema.index({ ownerId: 1, createdAt: -1 });
itinerarySchema.index({ ownerId: 1, isSaved: 1, createdAt: -1 });

/**
 * Share tokens must be unique, but only among trips that actually have one.
 *
 * A PARTIAL index indexes only documents matching the filter, so unshared
 * trips are excluded entirely regardless of whether the field is null or
 * absent. This is the modern replacement for `sparse` and is immune to the
 * null-collision bug described on the field above.
 */
itinerarySchema.index(
  { shareToken: 1 },
  { unique: true, partialFilterExpression: { shareToken: { $type: 'string' } } }
);

module.exports = mongoose.model('Itinerary', itinerarySchema);
