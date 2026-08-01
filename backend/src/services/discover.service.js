'use strict';

const Hotel = require('../models/Hotel');
const Restaurant = require('../models/Restaurant');
const TouristPlace = require('../models/TouristPlace');
const Destination = require('../models/Destination');
const Itinerary = require('../models/Itinerary');
const UserActivity = require('../models/UserActivity');
const { TIER_BASE } = require('../constants/travelProfile');
const AppError = require('../utils/AppError');

/**
 * ============================================================================
 * WHAT THIS FILE DOES — "what's around me, and what should I do about it"
 * ============================================================================
 *   Nearby hotels/restaurants/attractions   one geo query, three entity types
 *   Weather                                 climate normals from the briefing
 *   Budget calculator                       costs from real inventory prices
 *   Travel checklist                        derived from destination + profile
 *   Personalized recommendations            from favourites, views and trips
 *
 * ON WEATHER — read this before showing it to anyone
 * There is no live weather API wired up. This returns CLIMATE NORMALS derived
 * from the destination briefing's season data: what the weather is typically
 * like in a given month. It is labelled `isForecast: false` and the UI says
 * "typical conditions", not "forecast". Calling monthly averages a forecast
 * would be a lie, and a traveller might pack based on it.
 * ============================================================================
 */

const MODELS = {
  hotel: Hotel,
  restaurant: Restaurant,
  place: TouristPlace,
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const MONTH_INDEX = MONTHS.reduce((acc, m, i) => {
  acc[m.slice(0, 3).toLowerCase()] = i;
  return acc;
}, {});

/**
 * Expands a month-range string into the months it actually covers.
 *
 *   "Nov-Feb"        -> [Nov, Dec, Jan, Feb]   (wraps across the year end)
 *   "Mar-May, Sep"   -> [Mar, Apr, May, Sep]
 *
 * Naive substring matching was wrong here: asking "is December in Nov-Feb?"
 * by checking whether "nov-feb" contains "dec" is always false, so every
 * winter month was reported as off-season. Ranges have to be expanded.
 */
const expandMonthRange = (text = '') => {
  const covered = new Set();

  for (const part of String(text).split(/[,;/]/)) {
    const found = [...part.toLowerCase().matchAll(/[a-z]{3,}/g)]
      .map((m) => MONTH_INDEX[m[0].slice(0, 3)])
      .filter((i) => i !== undefined);

    if (!found.length) continue;

    if (found.length === 1) {
      covered.add(found[0]);
      continue;
    }

    // Two or more names in one part means a range; walk from first to last,
    // wrapping past December when the range crosses the year boundary.
    const [start, end] = [found[0], found[found.length - 1]];
    for (let i = start; ; i = (i + 1) % 12) {
      covered.add(i);
      if (i === end) break;
    }
  }

  return covered;
};

const monthInRange = (month, rangeText) =>
  expandMonthRange(rangeText).has(MONTHS.indexOf(month));

class DiscoverService {
  // ----------------------------------------------------------------- nearby

  /**
   * "What's within N km of this point?"
   *
   * Uses $nearSphere against the 2dsphere index, which returns results already
   * sorted by distance — no post-sort needed, and it stays fast as the
   * collection grows.
   */
  async nearby({ lat, lng, types = ['hotel', 'restaurant', 'place'], radiusKm = 5, limit = 8 }) {
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new AppError('Valid lat and lng are required.', 400);
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new AppError('Coordinates out of range.', 400);
    }

    const radiusMeters = Math.min(Math.max(Number(radiusKm) || 5, 0.2), 100) * 1000;
    const wanted = types.filter((t) => MODELS[t]);

    const results = await Promise.all(
      wanted.map(async (type) => {
        const docs = await MODELS[type].find({
          location: {
            $nearSphere: {
              $geometry: { type: 'Point', coordinates: [longitude, latitude] },
              $maxDistance: radiusMeters,
            },
          },
        }).limit(limit).lean();

        // Distance is what makes this list meaningful, so compute it back.
        return [type, docs.map((d) => ({
          ...d,
          distanceKm: Number(this._haversine(latitude, longitude, d.latitude, d.longitude).toFixed(2)),
        }))];
      })
    );

    return {
      origin: { latitude, longitude },
      radiusKm: radiusMeters / 1000,
      ...Object.fromEntries(results),
    };
  }

  _haversine(aLat, aLng, bLat, bLng) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const x = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // ---------------------------------------------------------------- weather

  /**
   * Typical conditions by month, from the cached destination briefing.
   * NOT a forecast — see the file header.
   */
  async weather(citySlug, month) {
    const DestinationIntelligence = require('../models/DestinationIntelligence');

    const [dest, intel] = await Promise.all([
      Destination.findOne({ citySlug }).lean(),
      DestinationIntelligence.findOne({ citySlug }).lean(),
    ]);

    if (!dest) throw new AppError('Destination not found.', 404);

    const weather = intel?.intelligence?.weather || null;
    const bestSeason = intel?.intelligence?.bestSeason || null;
    const targetMonth = MONTHS.includes(month) ? month : MONTHS[new Date().getMonth()];

    // Match the requested month against each season's month range, expanding
    // ranges like "Nov-Feb" so December is correctly recognised as in season.
    const matched = (weather?.seasons || []).find((s) => monthInRange(targetMonth, s.months));

    return {
      city: dest.cityName,
      citySlug,
      month: targetMonth,
      /** Explicit: this is climate data, not a forecast. */
      isForecast: false,
      source: intel ? 'destination-briefing' : 'seed-data',
      overview: weather?.overview || null,
      current: matched
        ? {
            season: matched.season,
            temperatureRange: matched.temperatureRange,
            description: matched.description,
          }
        : null,
      seasons: weather?.seasons || [],
      bestSeason: bestSeason || (dest.bestSeason ? { recommendedMonths: dest.bestSeason } : null),
      isGoodTime: bestSeason?.recommendedMonths
        ? monthInRange(targetMonth, bestSeason.recommendedMonths)
        : null,
    };
  }

  // ------------------------------------------------------------ budget calc

  /**
   * Budget estimate built from REAL inventory prices for that city, not from
   * generic per-day figures. Falls back to the destination price tier when a
   * city has no seeded inventory.
   */
  async budget({ citySlug, days = 3, travellers = 2, budgetTier = 'moderate' }) {
    const dest = await Destination.findOne({ citySlug }).lean();
    if (!dest) throw new AppError('Destination not found.', 404);

    const nights = Math.max(1, Number(days) - 1);
    const people = Math.max(1, Number(travellers));
    const tier = dest.priceTier || 3;

    // Median is a better central estimate than mean here — a couple of
    // ultra-luxury properties would drag an average badly.
    const median = (nums) => {
      if (!nums.length) return null;
      const s = [...nums].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };

    const band = { budget: 0.55, moderate: 1, luxury: 2.4 }[budgetTier] ?? 1;

    const [hotels, restaurants, places] = await Promise.all([
      Hotel.find({ citySlug }).select('pricePerNight').lean(),
      Restaurant.find({ citySlug }).select('priceForTwo').lean(),
      TouristPlace.find({ citySlug }).select('entryFeeInr').lean(),
    ]);

    const hotelNight =
      median(hotels.map((h) => h.pricePerNight)) ?? Math.round(TIER_BASE.hotelPerNight[tier] * band);
    const mealForTwo =
      median(restaurants.map((r) => r.priceForTwo)) ?? Math.round(TIER_BASE.mealForTwo[tier] * band);
    const avgEntry = median(places.map((p) => p.entryFeeInr || 0)) ?? 0;

    // Rooms: two travellers share; a fifth person needs a third room.
    const rooms = Math.ceil(people / 2);
    const accommodation = Math.round(hotelNight * band * nights * rooms);
    // Two meals out per day, priced per two people.
    const food = Math.round((mealForTwo * band / 2) * people * days * 2);
    const activities = Math.round((avgEntry || TIER_BASE.mealForTwo[tier] * 0.4) * people * days);
    const localTransport = Math.round(TIER_BASE.mealForTwo[tier] * 0.6 * days * Math.ceil(people / 3));
    const buffer = Math.round((accommodation + food + activities + localTransport) * 0.1);

    const total = accommodation + food + activities + localTransport + buffer;

    return {
      city: dest.cityName,
      citySlug,
      days: Number(days),
      nights,
      travellers: people,
      budgetTier,
      currency: 'INR',
      basedOn: hotels.length
        ? `${hotels.length} hotels and ${restaurants.length} restaurants in our database`
        : `price tier ${tier} estimates (no inventory seeded for this city)`,
      breakdown: [
        { label: 'Accommodation', amount: accommodation, detail: `${nights} nights × ${rooms} room${rooms > 1 ? 's' : ''}` },
        { label: 'Food', amount: food, detail: `${days} days × 2 meals × ${people}` },
        { label: 'Activities', amount: activities, detail: 'entry fees and experiences' },
        { label: 'Local transport', amount: localTransport, detail: 'taxis and local travel' },
        { label: 'Buffer', amount: buffer, detail: '10% contingency' },
      ],
      total,
      perPerson: Math.round(total / people),
      perPersonPerDay: Math.round(total / people / Number(days)),
    };
  }

  // -------------------------------------------------------------- checklist

  /**
   * Builds a checklist from the destination briefing plus the traveller
   * profile. Generic packing lists are useless; this one knows you're going
   * somewhere cold, or with children, or that you need a visa.
   */
  buildChecklist({ intelligence, profile, destination }) {
    const items = [];
    const add = (category, label) =>
      items.push({
        id: `${category}-${items.length}`.toLowerCase(),
        label,
        category,
        done: false,
        custom: false,
      });

    add('Documents', 'Government photo ID');
    add('Documents', 'Booking confirmations (offline copy)');
    add('Documents', 'Travel insurance details');

    const pack = intelligence?.packingSuggestions;
    if (pack) {
      (pack.documents || []).forEach((d) => add('Documents', d));
      (pack.essentials || []).forEach((e) => add('Essentials', e));
      (pack.seasonal || []).forEach((s) => add('Seasonal', s));
    } else {
      add('Essentials', 'Chargers and power adapter');
      add('Essentials', 'Basic medication and first aid');
    }

    // Profile-driven items — this is what makes it feel personal.
    if (profile?.travellerType === 'family') {
      add('Family', 'Snacks and entertainment for children');
      add('Family', 'Any child medication');
    }
    if (profile?.adventureLevel === 'high') {
      add('Activity', 'Broken-in walking or hiking shoes');
      add('Activity', 'Daypack and refillable water bottle');
    }
    if (profile?.travellerType === 'solo') {
      add('Safety', 'Share your itinerary with someone at home');
    }
    if ((profile?.foodPreferences || []).some((f) => f !== 'no-restrictions')) {
      add('Food', 'Dietary requirement card in the local language');
    }

    if (intelligence?.emergencyNumbers?.length) {
      add('Safety', `Save emergency numbers for ${destination}`);
    }
    add('Before you go', 'Notify your bank of travel dates');
    add('Before you go', 'Check passport validity and visa requirements');

    return items;
  }

  /** Generates and persists a checklist onto an itinerary, once. */
  async getOrCreateChecklist(userId, itineraryId) {
    const trip = await Itinerary.findOne({ _id: itineraryId, ownerId: userId }).lean();
    if (!trip) throw new AppError('Trip not found.', 404);

    if (trip.checklist?.length) return { items: trip.checklist };

    const items = this.buildChecklist({
      intelligence: trip.destinationIntelligence,
      profile: trip.profile,
      destination: trip.destination,
    });

    await Itinerary.updateOne({ _id: itineraryId }, { checklist: items });
    return { items };
  }

  async updateChecklistItem(userId, itineraryId, itemId, done) {
    const res = await Itinerary.updateOne(
      { _id: itineraryId, ownerId: userId, 'checklist.id': itemId },
      { $set: { 'checklist.$.done': Boolean(done) } }
    );
    if (!res.matchedCount) throw new AppError('Checklist item not found.', 404);
    return { id: itemId, done: Boolean(done) };
  }

  async addChecklistItem(userId, itineraryId, label) {
    const clean = String(label || '').trim().slice(0, 120);
    if (!clean) throw new AppError('A label is required.', 400);

    const item = {
      id: `custom-${Date.now()}`,
      label: clean,
      category: 'Custom',
      done: false,
      custom: true,
    };

    const res = await Itinerary.updateOne(
      { _id: itineraryId, ownerId: userId },
      { $push: { checklist: item } }
    );
    if (!res.matchedCount) throw new AppError('Trip not found.', 404);
    return item;
  }

  // -------------------------------------------------- recommendations

  /**
   * Personalised suggestions from what the user has actually done.
   *
   * Signals, strongest first:
   *   1. Cities they favourited things in  — clear intent
   *   2. Cities they recently viewed       — active interest
   *   3. Interests from past trip profiles — stated preference
   *
   * With no signals at all it falls back to popular destinations, which is the
   * correct cold-start behaviour rather than an empty panel.
   */
  async recommendations(userId, { limit = 6 } = {}) {
    const [favorites, recent, trips] = await Promise.all([
      UserActivity.find({ userId, kind: 'favorite' }).select('snapshot refType').lean(),
      UserActivity.find({ userId, kind: 'recently_viewed' }).select('refId').lean(),
      Itinerary.find({ ownerId: userId }).select('destination profile').limit(20).lean(),
    ]);

    const seenSlugs = new Set([
      ...recent.map((r) => r.refId),
      ...trips.map((t) => (t.destination || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    ].filter(Boolean));

    // Which tags does this user gravitate toward?
    const interestWeights = {};
    for (const t of trips) {
      for (const i of t.profile?.interests || []) {
        interestWeights[i] = (interestWeights[i] || 0) + 2;
      }
    }
    for (const f of favorites) {
      const slug = f.snapshot?.citySlug;
      if (slug) seenSlugs.add(slug);
    }

    const INTEREST_TO_TAG = {
      history: 'unesco', culture: 'heritage', beaches: 'beach', nature: 'hill',
      adventure: 'hill', wildlife: 'wildlife', spirituality: 'pilgrimage',
      shopping: 'metro', nightlife: 'metro', architecture: 'unesco',
    };

    const preferredTags = [...new Set(
      Object.entries(interestWeights)
        .sort((a, b) => b[1] - a[1])
        .map(([i]) => INTEREST_TO_TAG[i])
        .filter(Boolean)
    )];

    const hasSignal = preferredTags.length > 0 || seenSlugs.size > 0;

    const query = { citySlug: { $nin: [...seenSlugs] } };
    if (preferredTags.length) query.tags = { $in: preferredTags };

    /**
     * $sample, not find().limit().
     *
     * find() with no sort returns documents in natural (insertion) order, so
     * this always handed back the first six seeded destinations — the India
     * metros — for every user, on every page load, out of 171 available. The
     * panel looked broken and the personalisation looked fake.
     *
     * $sample draws a random subset instead, so the panel actually changes and
     * the whole catalogue gets surfaced over time. Cheap here: MongoDB uses a
     * random cursor when the sample is small relative to the collection.
     */
    let items = await Destination.aggregate([
      { $match: query },
      { $sample: { size: limit * 2 } },
    ]);

    // Widen in stages rather than ever returning an empty panel.
    // 1. Drop the tag filter, keep excluding places they've already seen.
    if (items.length < limit) {
      const extra = await Destination.aggregate([
        { $match: { citySlug: { $nin: [...seenSlugs, ...items.map((i) => i.citySlug)] } } },
        { $sample: { size: Math.max(1, limit * 2 - items.length) } },
      ]);
      items = [...items, ...extra];
    }

    // 2. Still nothing — the user has seen everything we have. Showing places
    //    they already know beats showing an empty panel.
    if (!items.length) {
      items = await Destination.aggregate([{ $sample: { size: limit } }]);
    }

    return {
      basedOn: hasSignal
        ? {
            interests: preferredTags,
            favouriteCount: favorites.length,
            tripCount: trips.length,
          }
        : null,
      reason: hasSignal
        ? `Because you're interested in ${preferredTags.join(', ') || 'travel'}`
        : 'Popular destinations to get you started',
      items: items.slice(0, limit).map((d) => ({
        citySlug: d.citySlug,
        cityName: d.cityName,
        state: d.state,
        country: d.country,
        tags: d.tags,
        priceTier: d.priceTier,
        description: d.description,
        // imageUrl is the card photo; vrImageUrl is the 360° panorama. The
        // fallback keeps data seeded before imageUrl existed still rendering.
        image: d.imageUrl || d.vrImageUrl,
        bestSeason: d.bestSeason,
        latitude: d.latitude,
        longitude: d.longitude,
      })),
    };
  }
}

module.exports = new DiscoverService();
module.exports.expandMonthRange = expandMonthRange;
module.exports.monthInRange = monthInRange;
