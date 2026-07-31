'use strict';

const mongoose = require('mongoose');

/** See Hotel.js for why citySlug exists (index-backed exact match vs regex scan). */
const touristPlaceSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    citySlug: { type: String, required: true, lowercase: true, trim: true },
    country: { type: String, default: 'India' },

    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'Sightseeing', index: true },
    description: { type: String },

    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    recommendedVisitTime: { type: String, default: 'Morning / Evening' },
    averageTimeRequired: { type: String, default: '2 - 3 hours' },
    entryFeeInr: { type: Number, default: 0, min: 0 },

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

touristPlaceSchema.pre('validate', function setSlug(next) {
  if (this.city) this.citySlug = toSlug(this.city);
  next();
});

touristPlaceSchema.statics.toSlug = toSlug;

touristPlaceSchema.index({ citySlug: 1, rating: -1 });
touristPlaceSchema.index({ citySlug: 1, category: 1 });
touristPlaceSchema.index({ name: 'text', description: 'text' });


// Mirror lat/lng into GeoJSON on every save so the two can never drift.
touristPlaceSchema.pre('validate', function setGeo(next) {
  if (typeof this.longitude === 'number' && typeof this.latitude === 'number') {
    this.location = { type: 'Point', coordinates: [this.longitude, this.latitude] };
  }
  next();
});

touristPlaceSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('TouristPlace', touristPlaceSchema);
