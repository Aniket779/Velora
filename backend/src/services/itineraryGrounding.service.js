'use strict';

const AppError = require('../utils/AppError');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Check the AI actually used our data"
 * ============================================================================
 * The AI returns activities with a code like "H1". This file:
 *
 *   1. Looks up H1 in the catalogue -> finds the real MongoDB document
 *   2. Attaches the real name, price, rating, image and coordinates
 *   3. If the AI made up a code that doesn't exist (e.g. "H99") -> REJECT
 *   4. If fewer than 50% of activities use real data -> REJECT
 *
 * WHY THIS FILE EXISTS
 * The prompt ASKS the AI to only use our catalogue. This file VERIFIES it did.
 * Without verification the rule is just a polite request, and when the AI
 * ignores it you get a fake hotel that looks completely real until a user
 * tries to book it.
 *
 * Rejecting means the job fails, the user sees an honest error, and BullMQ
 * can retry. That is much better than silently showing invented hotels.
 * ============================================================================
 */

const REF_PATTERN = /^[HRPF]\d+$/;

class ItineraryGroundingService {
  /**
   * @returns {{ itinerary, stats, usedDocs }}
   */
  ground(rawItinerary, catalog) {
    const stats = {
      totalActivities: 0,
      referencedActivities: 0,
      unreferencedActivities: 0,
      invalidRefs: [],
      resolvedByKind: { hotel: 0, restaurant: 0, place: 0, flight: 0 },
    };

    const usedDocs = { hotels: new Map(), restaurants: new Map(), places: new Map(), flights: new Map() };
    const bucket = { hotel: usedDocs.hotels, restaurant: usedDocs.restaurants, place: usedDocs.places, flight: usedDocs.flights };

    const days = (rawItinerary.days || []).map((day) => ({
      ...day,
      activities: (day.activities || []).map((activity) => {
        stats.totalActivities += 1;

        const ref = typeof activity.ref === 'string' ? activity.ref.trim().toUpperCase() : null;

        if (!ref || ref === 'NULL' || ref === '') {
          stats.unreferencedActivities += 1;
          return { ...activity, ref: null, resolved: null };
        }

        if (!REF_PATTERN.test(ref)) {
          stats.invalidRefs.push({ ref: activity.ref, title: activity.title, reason: 'malformed' });
          stats.unreferencedActivities += 1;
          return { ...activity, ref: null, resolved: null };
        }

        const entry = catalog.codeMap.get(ref);
        if (!entry) {
          // The model invented a code that was never in the catalogue.
          stats.invalidRefs.push({ ref, title: activity.title, reason: 'not in catalogue' });
          stats.unreferencedActivities += 1;
          return { ...activity, ref: null, resolved: null };
        }

        stats.referencedActivities += 1;
        stats.resolvedByKind[entry.kind] += 1;
        bucket[entry.kind].set(String(entry.doc._id), entry.doc);

        // Authoritative fields come from the database, not from the model. If the
        // model misremembered a price or a name while transcribing the catalogue,
        // the database wins.
        return {
          ...activity,
          ref,
          resolved: {
            kind: entry.kind,
            id: entry.doc._id,
            name: entry.doc.hotelName || entry.doc.name || entry.doc.airline || null,
            image: (entry.doc.images && entry.doc.images[0]) || null,
            rating: entry.doc.rating ?? null,
            latitude: entry.doc.latitude ?? null,
            longitude: entry.doc.longitude ?? null,
            price:
              entry.doc.pricePerNight ??
              entry.doc.priceForTwo ??
              entry.doc.price ??
              null,
            address: entry.doc.address || null,
          },
        };
      }),
    }));

    return {
      itinerary: { ...rawItinerary, days },
      stats,
      usedDocs: {
        hotels: [...usedDocs.hotels.values()],
        restaurants: [...usedDocs.restaurants.values()],
        places: [...usedDocs.places.values()],
        flights: [...usedDocs.flights.values()],
      },
    };
  }

  /**
   * Quality gate.
   *
   * A plan where the model largely ignored the catalogue is not a grounded plan, and
   * shipping it silently would recreate exactly the problem grounding was built to
   * solve. Failing the job means the user sees an honest error and BullMQ retries,
   * which is the correct outcome.
   */
  assertQuality(stats, catalog, { minGroundingRatio = 0.5 } = {}) {
    const catalogueIsEmpty =
      catalog.counts.hotels === 0 &&
      catalog.counts.restaurants === 0 &&
      catalog.counts.places === 0;

    if (catalogueIsEmpty) {
      // Nothing to ground against — the destination has no inventory seeded. Allow
      // it through so the traveller still gets the destination briefing.
      return { ok: true, degraded: true, reason: 'no inventory for destination' };
    }

    if (stats.invalidRefs.length > 0) {
      throw new AppError(
        `Generated itinerary referenced ${stats.invalidRefs.length} item(s) not in the catalogue ` +
          `(${stats.invalidRefs.slice(0, 3).map((r) => r.ref).join(', ')}). Rejected as ungrounded.`,
        502
      );
    }

    const groundable = stats.totalActivities;
    const ratio = groundable ? stats.referencedActivities / groundable : 0;

    if (ratio < minGroundingRatio) {
      throw new AppError(
        `Only ${Math.round(ratio * 100)}% of activities referenced real inventory ` +
          `(minimum ${Math.round(minGroundingRatio * 100)}%). Rejected as insufficiently grounded.`,
        502
      );
    }

    return { ok: true, degraded: false, ratio };
  }
}

module.exports = new ItineraryGroundingService();
