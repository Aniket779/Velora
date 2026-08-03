'use strict';

const mongoose = require('mongoose');

/**
 * ============================================================================
 * DESTINATION — the city guide record
 * ============================================================================
 * One document per city. Holds the curated facts (real coordinates, airport,
 * culture, local dishes) that the AI briefing is layered on top of.
 * ============================================================================
 */

const destinationSchema = new mongoose.Schema(
  {
    cityName: { type: String, required: true, trim: true },
    citySlug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: 'India', trim: true },

    airportCode: { type: String, uppercase: true, trim: true },
    /** metro | hill | beach | desert | pilgrimage | wildlife | unesco | heritage */
    tags: [{ type: String }],
    /** 1 (cheapest) to 5 (most expensive) — drives generated pricing. */
    priceTier: { type: Number, min: 1, max: 5, default: 3 },

    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },

    description: { type: String, required: true },
    bestSeason: { type: String },
    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: null },
    languages: [{ type: String }],

    famousFoods: [{ type: String }],
    traditionsAndCulture: { type: String },
    /**
     * Real landmarks, curated per city in the seed data.
     *
     * imageUrl is populated separately by `npm run fetch-images`, which looks
     * each landmark up on Wikipedia. It is deliberately NOT generated: these
     * are real named places, and a stock photo standing in for one is the
     * failure that had Delhi illustrated with the Taj Mahal.
     *
     * Absent imageUrl means "we have no photo of this", and the UI skips it.
     */
    famousPlaces: [{
      name: String,
      description: String,
      category: String,
      imageUrl: String,
      wikipediaUrl: String,
      /** Wikipedia images are CC-licensed; attribution is a condition of use. */
      attribution: String,
    }],
    localTransport: [{ type: String }],

    /** Card thumbnail (16:9-ish). Distinct from the 360° panorama below. */
    imageUrl: { type: String },

    /**
     * Equirectangular 360° panorama for the VR viewer.
     * NOT interchangeable with imageUrl — a panorama looks stretched and
     * warped when rendered into a card, which is what the recommendations
     * panel was doing before imageUrl existed.
     */
    vrImageUrl: { type: String },
  },
  { timestamps: true }
);

destinationSchema.pre('validate', function setSlug(next) {
  if (this.cityName && !this.citySlug) {
    this.citySlug = this.cityName.toString().trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  next();
});

destinationSchema.index({ country: 1, priceTier: 1 });
destinationSchema.index({ tags: 1 });
destinationSchema.index({ cityName: 'text', description: 'text' });

module.exports = mongoose.model('Destination', destinationSchema);
