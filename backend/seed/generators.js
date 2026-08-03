'use strict';

/**
 * ============================================================================
 * WHAT THIS FILE DOES — turns one destination into a full set of records
 * ============================================================================
 * Input:  one destination from seed/data/*.js  (real city, real coords, real sights)
 * Output: hotels, restaurants, attractions and flights for that city
 *
 * DETERMINISTIC BY DESIGN
 * Every random choice comes from a seeded RNG keyed on the city name, so
 * running the seed twice produces byte-identical data. That means you can
 * re-seed without your app behaving differently, and bugs are reproducible.
 *
 * PRICE TIERS
 * Every destination has a tier 1-5 that scales all prices. Tier 1 is a cheap
 * Indian town, tier 5 is Zurich or Tokyo. This is what makes a ₹1,200 hotel
 * in Pushkar and a ₹45,000 hotel in Santorini both look believable.
 * ============================================================================
 */

const P = require('./pools');

// --- Deterministic random ------------------------------------------------
// Mulberry32: tiny, fast, good enough distribution for seed data.

const makeRng = (seedString) => {
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const pickN = (rng, arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
};
const between = (rng, min, max) => min + rng() * (max - min);
const intBetween = (rng, min, max) => Math.floor(between(rng, min, max + 1));
const round = (n, to = 50) => Math.round(n / to) * to;

/** Shift coordinates a realistic distance from the city centre (roughly 0-8 km). */
const jitterCoord = (rng, lat, lng, kmRadius = 8) => {
  const dLat = (between(rng, -1, 1) * kmRadius) / 111;
  const dLng = (between(rng, -1, 1) * kmRadius) / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return [Number((lat + dLat).toFixed(6)), Number((lng + dLng).toFixed(6))];
};

const slugify = (s) => s.toString().trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// --- Pricing -------------------------------------------------------------
//
// Base nightly hotel rate in INR for a mid-range room, by destination tier.
// Single source of truth, shared with runtime budget filtering so generated
// prices and the catalogue's budget ceilings use the same scale.
const { TIER_BASE } = require('../src/constants/travelProfile');
const TIER_HOTEL_BASE = TIER_BASE.hotelPerNight;
const TIER_MEAL_BASE = TIER_BASE.mealForTwo;

const STYLE_MULTIPLIER = { budget: 0.45, mid: 1, luxury: 2.8 };

const regionOf = (d) => {
  if (d.country === 'India') return 'india';
  if (['Japan', 'China', 'Thailand', 'Vietnam', 'Indonesia', 'Singapore', 'South Korea'].includes(d.country)) return 'asia';
  if (['France', 'Italy', 'Spain', 'Germany', 'Netherlands', 'Greece', 'Portugal', 'Switzerland',
    'Austria', 'Czech Republic', 'Hungary', 'Croatia', 'Denmark', 'Sweden', 'Norway', 'Iceland',
    'United Kingdom', 'Ireland', 'Belgium'].includes(d.country)) return 'europe';
  return 'generic';
};

const primaryTag = (d) => (d.tags && d.tags[0]) || 'generic';

// =========================================================================
// HOTELS
// =========================================================================

const generateHotels = (d, count = 14) => {
  const rng = makeRng(`hotels:${d.city}`);
  const region = regionOf(d);
  const tag = primaryTag(d);
  const base = TIER_HOTEL_BASE[d.tier];
  const images = P.IMAGES[tag] || P.IMAGES.hotel;

  // Roughly 30% budget, 45% mid, 25% luxury — mirrors a real city's mix.
  const styleFor = (i) => (i < count * 0.3 ? 'budget' : i < count * 0.75 ? 'mid' : 'luxury');

  return Array.from({ length: count }, (_, i) => {
    const style = styleFor(i);
    const area = pick(rng, d.areas);
    const prefix = pick(rng, P.HOTEL_PREFIX[region] || P.HOTEL_PREFIX.generic);
    const suffix = style === 'budget'
      ? pick(rng, P.HOTEL_BRAND_STYLE.budget)
      : pick(rng, P.HOTEL_SUFFIX[tag] || P.HOTEL_SUFFIX.generic);

    const name = `${prefix} ${area} ${suffix}`.replace(/\s+/g, ' ').trim();

    const price = round(base * STYLE_MULTIPLIER[style] * between(rng, 0.82, 1.25), 50);
    // Luxury properties skew higher-rated; budget spreads wider.
    const rating = Number(
      (style === 'luxury' ? between(rng, 4.4, 4.9)
        : style === 'mid' ? between(rng, 3.9, 4.6)
        : between(rng, 3.3, 4.3)).toFixed(1)
    );
    const [lat, lng] = jitterCoord(rng, d.lat, d.lng, tag === 'metro' ? 12 : 7);
    const amenityPool = P.AMENITIES[style];

    return {
      city: d.city,
      citySlug: slugify(d.city),
      state: d.state,
      country: d.country,
      hotelName: name,
      address: `${area}, ${d.city}`,
      description: `${style === 'luxury' ? 'Upscale' : style === 'mid' ? 'Comfortable' : 'No-frills'} stay in ${area}, ${Math.round(between(rng, 1, 9))} km from the centre of ${d.city}.`,
      pricePerNight: price,
      rating,
      totalReviews: intBetween(rng, 45, 2400),
      amenities: pickN(rng, amenityPool, Math.min(amenityPool.length, intBetween(rng, 4, 7))),
      images: [P.unsplash(pick(rng, images))],
      latitude: lat,
      longitude: lng,
    };
  });
};

// =========================================================================
// RESTAURANTS
// =========================================================================

const generateRestaurants = (d, count = 16) => {
  const rng = makeRng(`restaurants:${d.city}`);
  const region = regionOf(d);
  const base = TIER_MEAL_BASE[d.tier];

  const patterns = P.RESTAURANT_PATTERN[region] || P.RESTAURANT_PATTERN.generic;
  const words = P.RESTAURANT_WORDS[region] || P.RESTAURANT_WORDS.generic;

  // Cuisine TYPE (e.g. "Goan"), not a dish name. The destination's dishes are
  // stored separately as signatureDishes.
  const regionalCuisine = d.country === 'India'
    ? (P.CUISINE_BY_INDIAN_STATE[d.state] || 'North Indian')
    : (P.CUISINE_BY_COUNTRY[d.country] || `${d.country} `.trim());
  const dishes = d.cuisines && d.cuisines.length ? d.cuisines : [];

  return Array.from({ length: count }, (_, i) => {
    const style = i < count * 0.35 ? 'budget' : i < count * 0.8 ? 'mid' : 'luxury';
    const area = pick(rng, d.areas);
    const name = pick(rng, patterns)
      .replace('{area}', area)
      .replace('{word}', pick(rng, words))
      .replace('{suffix}', pick(rng, P.RESTAURANT_SUFFIX))
      .replace(/\s+/g, ' ').trim();

    const priceForTwo = round(base * STYLE_MULTIPLIER[style] * between(rng, 0.8, 1.3), 50);
    const rating = Number(
      (style === 'luxury' ? between(rng, 4.3, 4.9) : between(rng, 3.6, 4.7)).toFixed(1)
    );
    const [lat, lng] = jitterCoord(rng, d.lat, d.lng, 6);

    // Most places serve the regional cuisine; some add a second, and the
    // upmarket ones lean multi-cuisine.
    const cuisine = [regionalCuisine];
    if (rng() > 0.45) cuisine.push(pick(rng, P.SECONDARY_CUISINES));

    return {
      city: d.city,
      citySlug: slugify(d.city),
      country: d.country,
      name,
      cuisine: [...new Set(cuisine)],
      /** Real dishes from this region that this place is known for. */
      signatureDishes: dishes.length ? pickN(rng, dishes, Math.min(dishes.length, 2)) : [],
      address: `${area}, ${d.city}`,
      rating,
      priceForTwo,
      openingHours: pick(rng, P.OPENING_HOURS),
      images: [P.unsplash(pick(rng, P.IMAGES.restaurant))],
      latitude: lat,
      longitude: lng,
    };
  });
};

// =========================================================================
// TOURIST ATTRACTIONS
// =========================================================================
// Real sights come first (from the destination's curated list). Generic ones
// only pad out the tail if a destination has fewer than the target count.

const generateAttractions = (d, count = 12) => {
  const rng = makeRng(`places:${d.city}`);
  const tag = primaryTag(d);
  const fillers = P.GENERIC_SIGHTS[tag] || P.GENERIC_SIGHTS.generic;

  // Curated real sights first, then city-named secondary activities to fill out
  // the list. Names are templated with the actual city so nothing reads as
  // generic filler.
  const entries = [...d.sights];
  for (const [template, category] of fillers) {
    if (entries.length >= count) break;
    const label = template.replace('{city}', d.city);
    if (!entries.some((e) => e[0] === label)) entries.push([label, category]);
  }

  return entries.slice(0, count).map(([name, category], i) => {
    const isReal = i < d.sights.length;
    const [lat, lng] = jitterCoord(rng, d.lat, d.lng, 15);
    const imgPool = P.IMAGES[tag] || P.IMAGES.generic;

    return {
      city: d.city,
      citySlug: slugify(d.city),
      name,
      category,
      description: isReal
        ? `${name} is one of the best-known sights in ${d.city}.`
        : `A popular ${category.toLowerCase()} experience in ${d.city}.`,
      /** True when this came from the curated real-attraction list. */
      isCurated: isReal,
      rating: Number((isReal ? between(rng, 4.2, 4.9) : between(rng, 3.8, 4.5)).toFixed(1)),
      recommendedVisitTime: pick(rng, P.VISIT_TIME),
      averageTimeRequired: pick(rng, P.DURATIONS),
      entryFeeInr: rng() > 0.35 ? round(between(rng, 0, 60) * d.tier * 12, 10) : 0,
      images: [P.unsplash(pick(rng, imgPool))],
      latitude: lat,
      longitude: lng,
    };
  });
};

// =========================================================================
// FLIGHTS
// =========================================================================
// Routes are generated from a set of hub airports to each destination. Fares
// scale with great-circle distance, which keeps Delhi->Goa cheap and
// Delhi->Sydney expensive without hand-tuning every route.

const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (aLat, aLng, bLat, bLng) => {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const minutesToHhMm = (mins) => `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`;
const clockFrom = (startMin) => {
  const m = ((startMin % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
};

const generateFlights = (destination, origins, perOrigin = 3) => {
  const rng = makeRng(`flights:${destination.city}`);
  const out = [];

  for (const origin of origins) {
    if (origin.city === destination.city) continue;

    const km = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
    if (km < 150) continue; // too close to fly

    const domestic = origin.country === destination.country;
    const airlines = domestic && destination.country === 'India'
      ? P.AIRLINES.india
      : P.AIRLINES.international;

    // ~800 km/h cruise plus 35 min for taxi/climb/descent.
    const durationMin = Math.round((km / 800) * 60 + 35);

    // Fare model: base + per-km, with an international premium.
    const baseFare = domestic ? 1800 : 9000;
    const perKm = domestic ? 4.2 : 5.8;

    for (let i = 0; i < perOrigin; i++) {
      const airline = pick(rng, airlines);
      const depMin = intBetween(rng, 5, 21) * 60 + pick(rng, [0, 10, 15, 25, 35, 40, 50]);
      const price = round(
        (baseFare + km * perKm) * between(rng, 0.85, 1.35) * (destination.tier >= 4 ? 1.15 : 1),
        100
      );

      out.push({
        from: origin.city,
        fromSlug: slugify(origin.city),
        to: destination.city,
        toSlug: slugify(destination.city),
        fromAirport: origin.airport,
        toAirport: destination.airport,
        airline: airline.name,
        flightNumber: `${airline.code}-${intBetween(rng, 100, 999)}`,
        departureTime: clockFrom(depMin),
        arrivalTime: clockFrom(depMin + durationMin),
        duration: minutesToHhMm(durationMin),
        durationMinutes: durationMin,
        distanceKm: Math.round(km),
        price,
        stops: km > 4500 && rng() > 0.5 ? 1 : 0,
        baggage: domestic ? '15 kg Check-in, 7 kg Cabin' : '30 kg Check-in, 7 kg Cabin',
        isInternational: !domestic,
      });
    }
  }

  return out;
};

// =========================================================================
// DESTINATION DOCUMENT (city guide record)
// =========================================================================

const generateDestinationDoc = (d) => ({
  cityName: d.city,
  citySlug: slugify(d.city),
  state: d.state,
  country: d.country,
  airportCode: d.airport,
  tags: d.tags,
  priceTier: d.tier,
  latitude: d.lat,
  longitude: d.lng,
  description: d.desc,
  bestSeason: d.best,
  currency: d.currency || 'INR',
  timezone: d.tz || null,
  languages: d.langs || [],
  famousFoods: d.cuisines || [],
  traditionsAndCulture: d.culture || d.desc,
  famousPlaces: d.sights.map(([name, category]) => ({
    name,
    category,
    description: `${category} attraction in ${d.city}.`,
    // imageUrl is filled in separately by `npm run fetch-images`, which looks
    // each landmark up on Wikipedia. Never generated — see the model comment.
  })),
  localTransport: d.transport || [],
  /**
   * Two images, because they are used for two different things.
   *
   * The old code set only vrImageUrl, to `IMAGES[primaryTag][0]` — the FIRST
   * photo of the FIRST tag. Every one of the 67 `metro` destinations therefore
   * carried a byte-identical URL, and the recommendations panel (six metros)
   * rendered six copies of the same photograph.
   *
   * imageUrl  card thumbnail. Picked per-city from the union of all its tags,
   *           so neighbouring cards differ.
   * vrImageUrl the 360° panorama for the VR viewer. Wider crop, and a poor
   *           card image — an equirectangular panorama looks stretched and
   *           warped in a 16:9 thumbnail.
   *
   * The pick is seeded from the city slug, so it is deterministic: reseeding
   * gives every city the same photo it had before, and the choice is stable
   * across environments.
   */
  imageUrl: (() => {
    const pool = P.imagesForTags(d.tags);
    const rng = makeRng(`img:${slugify(d.city)}`);
    return P.unsplash(pool[Math.floor(rng() * pool.length)], 800);
  })(),

  vrImageUrl: (() => {
    const pool = P.imagesForTags(d.tags);
    const rng = makeRng(`vr:${slugify(d.city)}`);
    return P.unsplash(pool[Math.floor(rng() * pool.length)], 1600);
  })(),
});

module.exports = {
  makeRng, slugify, haversineKm,
  generateHotels, generateRestaurants, generateAttractions,
  generateFlights, generateDestinationDoc,
  TIER_HOTEL_BASE, TIER_MEAL_BASE,
};
