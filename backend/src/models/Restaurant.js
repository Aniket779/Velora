'use strict';

const mongoose = require('mongoose');

/** See Hotel.js for why citySlug exists (index-backed exact match vs regex scan). */
const restaurantSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    citySlug: { type: String, required: true, lowercase: true, trim: true },
    country: { type: String, default: 'India' },

    name: { type: String, required: true, trim: true },
    /** Cuisine TYPE — "Goan", "Japanese", "Seafood". Not dish names. */
    cuisine: [{ type: String }],
    /** Specific regional dishes this place is known for. */
    signatureDishes: [{ type: String }],
    address: { type: String, required: true },

    rating: { type: Number, required: true, min: 0, max: 5 },
    priceForTwo: { type: Number, required: true, min: 0 },
    openingHours: { type: String, default: '11:00 AM - 11:00 PM' },

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

const toSlug = (value = '') =>
  value.toString().trim().split(',')[0].trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

restaurantSchema.pre('validate', function setSlug(next) {
  if (this.city) this.citySlug = toSlug(this.city);
  next();
});

restaurantSchema.statics.toSlug = toSlug;

restaurantSchema.index({ citySlug: 1, rating: -1 });
restaurantSchema.index({ citySlug: 1, priceForTwo: 1 });
// `cuisine` is an array, so this becomes a multikey index — what we want for
// "vegetarian restaurants in Goa" style filtering.
restaurantSchema.index({ citySlug: 1, cuisine: 1 });
restaurantSchema.index({ name: 'text' });


// Mirror lat/lng into GeoJSON on every save so the two can never drift.
restaurantSchema.pre('validate', function setGeo(next) {
  if (typeof this.longitude === 'number' && typeof this.latitude === 'number') {
    this.location = { type: 'Point', coordinates: [this.longitude, this.latitude] };
  }
  next();
});

restaurantSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Restaurant', restaurantSchema);
