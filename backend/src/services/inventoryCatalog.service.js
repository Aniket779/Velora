'use strict';

const Hotel = require('../models/Hotel');
const Restaurant = require('../models/Restaurant');
const TouristPlace = require('../models/TouristPlace');
const Flight = require('../models/Flight');
const Destination = require('../models/Destination');
const { resolveBudgetCeilings } = require('../constants/travelProfile');

/**
 * "Goa, India" -> "goa".  "New York" -> "new-york".
 *
 * We match on citySlug with an exact string compare rather than a
 * case-insensitive regex. MongoDB cannot use an index for /^x$/i, so the old
 * regex version scanned the entire collection on every search — invisible with
 * 3 hotels, very visible with thousands.
 */
const toSlug = (value = '') =>
  value.toString().trim().split(',')[0].trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Give the AI a menu to choose from"
 * ============================================================================
 * Pulls real hotels, restaurants, attractions and flights out of MongoDB and
 * turns them into a short text list with codes:
 *
 *     HOTELS
 *       H1 | Taj Exotica | 4.9* | Rs28000/night | Benaulim | Pool/Spa
 *       H2 | Casa Anjuna | 4.5* | Rs6500/night  | Anjuna   | Pool/WiFi
 *     RESTAURANTS
 *       R1 | Gunpowder | 4.6* | Rs1800 for two | South Indian
 *
 * That text goes into the AI prompt. The AI picks codes (H1, R1) instead of
 * inventing hotel names. This is the "R" in RAG (Retrieval Augmented
 * Generation) - we retrieve real data first, then ask the AI to use it.
 *
 * IMPORTANT: budget filtering happens HERE, in the database query - not in
 * the prompt. If you tell an AI "prefer cheap hotels" it will still sometimes
 * suggest the expensive one. If the expensive one was never in its list, it
 * physically cannot.
 * ============================================================================
 */
class InventoryCatalogService {
  /**
   * @returns {{ codeMap: Map<string, {kind, doc}>, hotels, restaurants, places, flights, counts }}
   */
  async buildCatalog(destination, origin, profile = {}) {
    const citySlug = toSlug(destination);

    // "Budget" means something different in Jaisalmer and in Zurich. Look up the
    // destination's price tier so the ceiling is relative to what this city
    // actually costs, not a fixed rupee amount.
    const destDoc = await Destination.findOne({ citySlug }).lean();
    const budget = resolveBudgetCeilings(profile.budget, destDoc?.priceTier || 3);

    const hotelFilter = { citySlug };
    if (budget.maxPricePerNight) {
      hotelFilter.pricePerNight = { $lte: budget.maxPricePerNight };
    }

    const restaurantFilter = { citySlug };
    if (budget.maxPriceForTwo) {
      restaurantFilter.priceForTwo = { $lte: budget.maxPriceForTwo };
    }

    const [hotels, restaurants, places, flights] = await Promise.all([
      Hotel.find(hotelFilter).sort({ rating: -1, pricePerNight: 1 }).limit(12).lean(),
      Restaurant.find(restaurantFilter).sort({ rating: -1 }).limit(15).lean(),
      TouristPlace.find({ citySlug }).sort({ rating: -1 }).limit(20).lean(),
      this._fetchFlights(destination, origin),
    ]);

    // A budget filter that eliminates everything is worse than no filter — the model
    // would have nothing to select and would fall back to inventing. Retry unfiltered.
    const finalHotels = hotels.length
      ? hotels
      : await Hotel.find({ citySlug }).sort({ pricePerNight: 1 }).limit(12).lean();

    const finalRestaurants = restaurants.length
      ? restaurants
      : await Restaurant.find({ citySlug }).sort({ priceForTwo: 1 }).limit(15).lean();

    const codeMap = new Map();
    const assign = (prefix, docs, kind) =>
      docs.map((doc, i) => {
        const code = `${prefix}${i + 1}`;
        codeMap.set(code, { kind, doc });
        return { code, doc };
      });

    return {
      codeMap,
      hotels: assign('H', finalHotels, 'hotel'),
      restaurants: assign('R', finalRestaurants, 'restaurant'),
      places: assign('P', places, 'place'),
      flights: assign('F', flights, 'flight'),
      counts: {
        hotels: finalHotels.length,
        restaurants: finalRestaurants.length,
        places: places.length,
        flights: flights.length,
      },
      budgetBand: budget,
    };
  }

  async _fetchFlights(destination, origin) {
    const fromSlug = toSlug(origin);
    const toDestSlug = toSlug(destination);

    // Uses the { fromSlug, toSlug, price } compound index.
    const direct = await Flight.find({ fromSlug, toSlug: toDestSlug })
      .sort({ price: 1 })
      .limit(8)
      .lean();
    if (direct.length) return direct;

    // No direct route seeded — fall back to any flight arriving at the destination.
    return Flight.find({ toSlug: toDestSlug }).sort({ price: 1 }).limit(8).lean();
  }

  /**
   * Renders the catalogue as compact text for the prompt.
   *
   * Deliberately terse: this block is sent on every generation, so verbosity here is
   * a recurring cost. One line per item, only the fields that inform selection.
   */
  renderForPrompt(catalog) {
    const lines = [];

    const section = (title, entries, formatter) => {
      if (!entries.length) return;
      lines.push(`\n${title}`);
      entries.forEach(({ code, doc }) => lines.push(`  ${code} | ${formatter(doc)}`));
    };

    section('HOTELS', catalog.hotels, (h) =>
      [
        h.hotelName,
        `${h.rating}★`,
        `₹${h.pricePerNight}/night`,
        h.address || h.city,
        (h.amenities || []).slice(0, 4).join('/') || 'no amenity data',
      ].join(' | ')
    );

    section('RESTAURANTS', catalog.restaurants, (r) =>
      [
        r.name,
        `${r.rating}★`,
        `₹${r.priceForTwo} for two`,
        (Array.isArray(r.cuisine) ? r.cuisine : [r.cuisine]).filter(Boolean).join('/') || 'cuisine n/a',
        // Signature dishes help the model honour dietary constraints and give
        // it something concrete to recommend ordering.
        (r.signatureDishes || []).length ? `known for: ${r.signatureDishes.join(', ')}` : '',
        r.openingHours || 'hours n/a',
      ].filter(Boolean).join(' | ')
    );

    section('ATTRACTIONS', catalog.places, (p) =>
      [
        p.name,
        p.category || 'Sightseeing',
        `${p.rating}★`,
        p.averageTimeRequired || 'duration n/a',
        p.recommendedVisitTime || 'anytime',
      ].join(' | ')
    );

    section('FLIGHTS', catalog.flights, (f) =>
      [
        `${f.airline} ${f.flightNumber}`,
        `${f.from}→${f.to}`,
        `${f.departureTime}-${f.arrivalTime}`,
        f.duration,
        `₹${f.price}`,
      ].join(' | ')
    );

    return lines.join('\n');
  }
}

module.exports = new InventoryCatalogService();
