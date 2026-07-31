'use strict';

const mongoose = require('mongoose');

/**
 * Cached destination knowledge.
 *
 * The 18-category briefing is expensive (a large prompt and a large completion) and
 * near-static per city — Goa's history does not change between requests. Generating
 * it per trip would make it the dominant cost of the product for no benefit.
 *
 * Cached by citySlug, refreshed when older than TTL_DAYS.
 */

const destinationIntelligenceSchema = new mongoose.Schema(
  {
    citySlug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true },

    /** The full 18-category payload, validated by Zod before it is written. */
    intelligence: { type: mongoose.Schema.Types.Mixed, required: true },

    /** Provenance — so a placeholder briefing is never mistaken for a real one. */
    isMock: { type: Boolean, default: false },
    promptVersion: { type: String, default: null },
    model: { type: String, default: null },

    /** True when emergency numbers came from the curated registry. */
    emergencyNumbersVerified: { type: Boolean, default: false },

    generatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DestinationIntelligence', destinationIntelligenceSchema);
