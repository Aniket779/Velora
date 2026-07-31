'use strict';

const mongoose = require('mongoose');

/**
 * ============================================================================
 * HOTEL
 * ============================================================================
 * WHY citySlug EXISTS
 * We used to query by city with a case-insensitive regex: /^Goa$/i. That looks
 * fine, but MongoDB CANNOT use an index for a regex with the `i` flag — so
 * every "hotels in Goa" query scanned the whole collection. The indexes existed
 * and were paid for on every write, but never used on a read.
 *
 * citySlug stores a normalised lowercase key ("goa", "new-york") set
 * automatically before save. Queries do an exact match on it, which IS
 * index-backed. Same results, but an index seek instead of a collection scan.
 * ============================================================================
 */

const hotelSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    citySlug: { type: String, required: true, lowercase: true, trim: true },
    state: { type: String, required: true },
    country: { type: String, default: 'India', index: true },

    hotelName: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    description: { type: String },

    pricePerNight: { type: Number, required: true, min: 0 },
    rating: { type: Number, required: true, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },

    amenities: [{ type: String }],
    images: [{ type: String }],


    /**
     * GeoJSON point for "what's near me" queries.
     *
     * latitude/longitude are kept for display; this mirrors them in the
     * [longitude, latitude] order MongoDB requires and is what the 2dsphere
     * index below actually uses. $near cannot use flat lat/lng fields.
     */
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined },
    },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
  },
  { timestamps: true }
);

/** "Goa, India" -> "goa".  Shared by every collection that keys on a city. */
const toSlug = (value = '') =>
  value.toString().trim().split(',')[0].trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Derive the slug automatically so no caller can forget it.
hotelSchema.pre('validate', function setSlug(next) {
  if (this.city) this.citySlug = toSlug(this.city);
  next();
});

hotelSchema.statics.toSlug = toSlug;

// --- Indexes -------------------------------------------------------------
// Ordered by how the app actually queries: always by city, then sorted by
// rating or price. A compound index also serves prefix queries, so a lone
// { citySlug: 1 } index would be redundant write cost.
hotelSchema.index({ citySlug: 1, rating: -1 });
hotelSchema.index({ citySlug: 1, pricePerNight: 1 });
hotelSchema.index({ citySlug: 1, pricePerNight: 1, rating: -1 });
hotelSchema.index({ country: 1, rating: -1 });
hotelSchema.index({ hotelName: 'text', description: 'text' });


// Mirror lat/lng into GeoJSON on every save so the two can never drift.
hotelSchema.pre('validate', function setGeo(next) {
  if (typeof this.longitude === 'number' && typeof this.latitude === 'number') {
    this.location = { type: 'Point', coordinates: [this.longitude, this.latitude] };
  }
  next();
});

hotelSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Hotel', hotelSchema);
