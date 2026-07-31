'use strict';

const mongoose = require('mongoose');

/**
 * ============================================================================
 * FLIGHT
 * ============================================================================
 * Route templates, not dated instances — one document per airline/route/time
 * combination. Adding a real date dimension is a planned change; for now the
 * search matches on route only.
 *
 * fromSlug / toSlug exist for the same reason as Hotel.citySlug: exact-match
 * lookups can use an index, case-insensitive regex cannot.
 * ============================================================================
 */

const flightSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, trim: true },
    fromSlug: { type: String, required: true, lowercase: true, trim: true },
    to: { type: String, required: true, trim: true },
    toSlug: { type: String, required: true, lowercase: true, trim: true },

    fromAirport: { type: String, uppercase: true, trim: true },
    toAirport: { type: String, uppercase: true, trim: true },

    airline: { type: String, required: true, trim: true },
    flightNumber: { type: String, required: true, trim: true },

    departureTime: { type: String, required: true },
    arrivalTime: { type: String, required: true },
    duration: { type: String, required: true },
    durationMinutes: { type: Number, min: 0 },
    distanceKm: { type: Number, min: 0 },

    price: { type: Number, required: true, min: 0 },
    stops: { type: Number, default: 0, min: 0 },
    baggage: { type: String, default: '15 kg Check-in, 7 kg Cabin' },
    isInternational: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const toSlug = (value = '') =>
  value.toString().trim().split(',')[0].trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

flightSchema.pre('validate', function setSlugs(next) {
  if (this.from) this.fromSlug = toSlug(this.from);
  if (this.to) this.toSlug = toSlug(this.to);
  next();
});

flightSchema.statics.toSlug = toSlug;

// The core search is "cheapest flights from A to B", so route + price is the
// index that matters. The toSlug-only index supports "any flight into B",
// which is the fallback when a direct route has no results.
flightSchema.index({ fromSlug: 1, toSlug: 1, price: 1 });
flightSchema.index({ toSlug: 1, price: 1 });
flightSchema.index({ airline: 1 });

module.exports = mongoose.model('Flight', flightSchema);
