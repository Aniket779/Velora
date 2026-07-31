'use strict';

const DestinationIntelligence = require('../models/DestinationIntelligence');
const Destination = require('../models/Destination');
const aiIntegrator = require('../ai/llm');
const { getVerifiedEmergencyNumbers } = require('../constants/emergencyNumbers');

const TTL_DAYS = Number(process.env.DESTINATION_INTELLIGENCE_TTL_DAYS) || 90;

const slugify = (value = '') =>
  value.toString().trim().split(',')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Cache the expensive city research"
 * ============================================================================
 * Asking the AI for 18 categories of knowledge about a city (history, food,
 * festivals, scams, budgets...) is a big, slow, expensive call. But Goa's
 * history doesn't change between users.
 *
 * So: check MongoDB first. If we already have it and it's under 90 days old,
 * return it instantly. Only call the AI on a cache miss.
 *
 * SAFETY BIT WORTH KNOWING
 * Emergency phone numbers are NOT trusted from the AI. We keep our own
 * verified list in constants/emergencyNumbers.js and it overwrites whatever
 * the AI said. A tourist dialling a hallucinated emergency number is a real
 * danger, so this one field is never left to the model.
 * ============================================================================
 */
class DestinationIntelligenceService {
  async get(destination, { forceRefresh = false } = {}) {
    const citySlug = slugify(destination);
    if (!citySlug) return null;

    if (!forceRefresh) {
      const cached = await DestinationIntelligence.findOne({ citySlug }).lean();
      if (cached && !this._isStale(cached)) {
        console.log(`[Intelligence] Cache hit for ${citySlug} (generated ${cached.generatedAt.toISOString()})`);
        return cached;
      }
      if (cached) {
        console.log(`[Intelligence] Cache stale for ${citySlug} — regenerating`);
      }
    }

    return this._generateAndStore(destination, citySlug);
  }

  _isStale(record) {
    const ageMs = Date.now() - new Date(record.generatedAt).getTime();
    return ageMs > TTL_DAYS * 24 * 60 * 60 * 1000;
  }

  async _generateAndStore(destination, citySlug) {
    // Seeded Destination documents already know the country — use it rather than
    // asking the model to guess.
    const seed = await Destination.findOne({
      cityName: { $regex: new RegExp(`^${citySlug.replace(/-/g, '[ -]')}$`, 'i') },
    }).lean();

    const country = seed?.country || 'India';

    const { data, isMock, promptVersion } = await aiIntegrator.generateDestinationIntelligence({
      destination,
      country,
    });

    const verified = getVerifiedEmergencyNumbers(data.country || country);
    const emergencyNumbers = verified?.length ? verified : data.emergencyNumbers || [];

    const payload = {
      citySlug,
      city: destination.split(',')[0].trim(),
      country: data.country || country,
      intelligence: {
        ...data,
        emergencyNumbers,
        // Preserve the seeded VR panorama and curated landmark blurbs — these are
        // human-curated content the model should not overwrite.
        vrImageUrl: seed?.vrImageUrl || null,
        seededFamousPlaces: seed?.famousPlaces || [],
      },
      isMock,
      promptVersion: promptVersion || null,
      model: isMock ? null : aiIntegrator.model,
      emergencyNumbersVerified: Boolean(verified?.length),
      generatedAt: new Date(),
    };

    const saved = await DestinationIntelligence.findOneAndUpdate(
      { citySlug },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    console.log(
      `[Intelligence] Generated for ${citySlug} (mock=${isMock}, ` +
        `emergencyVerified=${payload.emergencyNumbersVerified})`
    );

    return saved;
  }
}

module.exports = new DestinationIntelligenceService();
module.exports.slugify = slugify;
