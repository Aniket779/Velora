'use strict';

const { PACE_ACTIVITY_TARGET } = require('../constants/travelProfile');

/**
 * Deterministic placeholder generator used when OPENAI_API_KEY is absent.
 *
 * Two design decisions worth stating:
 *
 * 1. It builds the itinerary FROM THE REAL CATALOGUE, selecting actual codes. That
 *    means the grounding pipeline — reference resolution, validation, hydration —
 *    is exercised end to end without an API key. A mock that returned invented
 *    names would let grounding bugs hide until the first paid call.
 *
 * 2. Every string is prefixed or phrased so it is obvious this is placeholder
 *    content. The previous mock returned confident-sounding prose indistinguishable
 *    from real output, so a missing API key looked like a working feature.
 */

const PLACEHOLDER = '[placeholder — set GEMINI_API_KEY or OPENAI_API_KEY for real content]';

const destinationIntelligence = ({ destination, country = 'India' }) => ({
  country,
  oneLineSummary: `${destination} briefing ${PLACEHOLDER}`,
  history: `Historical background for ${destination}. ${PLACEHOLDER}`,
  culture: `Cultural overview for ${destination}. ${PLACEHOLDER}`,
  traditions: [`Local tradition in ${destination} ${PLACEHOLDER}`],
  famousFoods: [
    {
      name: `Signature dish of ${destination}`,
      description: PLACEHOLDER,
      whereToTry: PLACEHOLDER,
      vegetarian: true,
    },
  ],
  festivals: [{ name: `Annual festival in ${destination}`, months: 'Varies', description: PLACEHOLDER }],
  famousPlaces: [{ name: `Landmark in ${destination}`, whyVisit: PLACEHOLDER }],
  hiddenGems: [{ name: `Lesser-known spot in ${destination}`, whyVisit: PLACEHOLDER, howToReach: PLACEHOLDER }],
  localExperiences: [{ name: `Local experience in ${destination}`, description: PLACEHOLDER }],
  transportation: {
    gettingAround: PLACEHOLDER,
    fromAirport: PLACEHOLDER,
    options: [{ mode: 'Taxi', typicalCost: PLACEHOLDER, tips: PLACEHOLDER }],
  },
  shopping: {
    whatToBuy: [PLACEHOLDER],
    markets: [{ name: `Market in ${destination}`, knownFor: PLACEHOLDER }],
    bargainingTips: PLACEHOLDER,
  },
  weather: {
    overview: PLACEHOLDER,
    seasons: [
      { season: 'Peak', months: 'Nov-Feb', temperatureRange: PLACEHOLDER, description: PLACEHOLDER },
    ],
  },
  bestSeason: { recommendedMonths: 'Nov-Feb', why: PLACEHOLDER, monthsToAvoid: PLACEHOLDER },
  safetyTips: [PLACEHOLDER],
  scamsToAvoid: [{ scam: PLACEHOLDER, howItWorks: PLACEHOLDER, howToAvoid: PLACEHOLDER }],
  // Left empty deliberately: the verified registry fills this in, and inventing
  // emergency numbers is the one hallucination that could get someone hurt.
  emergencyNumbers: [],
  localEtiquette: {
    dos: [PLACEHOLDER],
    donts: [PLACEHOLDER],
    dressCode: PLACEHOLDER,
    tipping: PLACEHOLDER,
  },
  budgetEstimation: {
    currency: 'INR',
    notes: PLACEHOLDER,
    dailyByTier: [
      { tier: 'budget', accommodation: 1500, food: 600, localTransport: 300, activities: 400, totalPerPersonPerDay: 2800 },
      { tier: 'moderate', accommodation: 4500, food: 1500, localTransport: 800, activities: 1200, totalPerPersonPerDay: 8000 },
      { tier: 'luxury', accommodation: 15000, food: 4000, localTransport: 2500, activities: 3500, totalPerPersonPerDay: 25000 },
    ],
  },
  packingSuggestions: {
    essentials: [PLACEHOLDER],
    seasonal: [PLACEHOLDER],
    documents: ['Government photo ID', 'Booking confirmations'],
  },
});

/**
 * Builds a plan by cycling through real catalogue codes, so every `ref` resolves.
 */
const itinerary = ({ profile, catalog }) => {
  const dayCount = Math.min(Math.max(Number(profile.days) || 3, 1), 14);
  const hotel = catalog.hotels[0];
  const pick = (arr, i) => (arr.length ? arr[i % arr.length] : null);

  const days = Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1;
    const isFirst = index === 0;
    const isLast = index === dayCount - 1;
    const activities = [];

    if (isFirst) {
      const flight = catalog.flights[0];
      if (flight) {
        activities.push({
          title: `Flight to ${profile.destination}`,
          type: 'transit',
          ref: flight.code,
          location_name: `${flight.doc.from} → ${flight.doc.to}`,
          start_time: flight.doc.departureTime || '09:00',
          end_time: flight.doc.arrivalTime || '11:00',
          duration_minutes: 120,
          description: PLACEHOLDER,
          why_chosen: `Lowest fare available on this route for a ${profile.budget} budget.`,
          estimated_cost_inr: flight.doc.price || 0,
          booking_required: true,
          travel_from_previous: 'Depart from home',
        });
      }
      if (hotel) {
        activities.push({
          title: `Check in at ${hotel.doc.hotelName}`,
          type: 'hotel',
          ref: hotel.code,
          location_name: hotel.doc.hotelName,
          start_time: '14:00',
          end_time: '15:00',
          duration_minutes: 60,
          description: PLACEHOLDER,
          why_chosen: `Highest-rated stay within the ${profile.budget} band.`,
          estimated_cost_inr: hotel.doc.pricePerNight || 0,
          booking_required: true,
          travel_from_previous: 'Taxi from the airport',
        });
      }
    }

    const place = pick(catalog.places, index);
    if (place) {
      activities.push({
        title: `Visit ${place.doc.name}`,
        type: 'activity',
        ref: place.code,
        location_name: place.doc.name,
        start_time: isFirst ? '16:30' : '10:00',
        end_time: isFirst ? '18:00' : '12:30',
        duration_minutes: 150,
        description: place.doc.description || PLACEHOLDER,
        why_chosen: `Matches your stated interests: ${(profile.interests || []).join(', ') || 'general sightseeing'}.`,
        estimated_cost_inr: 300,
        booking_required: false,
        travel_from_previous: PLACEHOLDER,
      });
    }

    const restaurant = pick(catalog.restaurants, index);
    if (restaurant) {
      activities.push({
        title: `Dinner at ${restaurant.doc.name}`,
        type: 'food',
        ref: restaurant.code,
        location_name: restaurant.doc.name,
        start_time: '19:30',
        end_time: '21:00',
        duration_minutes: 90,
        description: PLACEHOLDER,
        why_chosen: `Fits your food preferences: ${(profile.foodPreferences || ['no-restrictions']).join(', ')}.`,
        estimated_cost_inr: restaurant.doc.priceForTwo || 0,
        booking_required: false,
        travel_from_previous: PLACEHOLDER,
      });
    }

    if (isLast && dayCount > 1) {
      activities.push({
        title: `Departure from ${profile.destination}`,
        type: 'transit',
        ref: null,
        location_name: `${profile.destination} Airport`,
        start_time: '18:00',
        end_time: '19:00',
        duration_minutes: 60,
        description: PLACEHOLDER,
        why_chosen: 'Return leg of the trip.',
        estimated_cost_inr: 0,
        booking_required: true,
        travel_from_previous: 'Taxi to the airport',
      });
    }

    return {
      day_number: dayNumber,
      theme: isFirst ? 'Arrival and settling in' : isLast ? 'Final morning and departure' : `Exploring ${profile.destination}`,
      activities,
      daily_budget_estimate_inr: activities.reduce((s, a) => s + (a.estimated_cost_inr || 0), 0),
      notes: PLACEHOLDER,
    };
  });

  return {
    trip_title: `${profile.days}-day ${profile.travellerType} trip to ${profile.destination}`,
    summary: `Placeholder itinerary for a ${profile.budget} ${profile.travellerType} trip. ${PLACEHOLDER}`,
    days,
    total_estimated_cost_inr: days.reduce((s, d) => s + d.daily_budget_estimate_inr, 0),
    personalisation_notes: [
      `Traveller type: ${profile.travellerType}`,
      `Adventure level: ${profile.adventureLevel}`,
      `Pace: ${profile.pace} (${PACE_ACTIVITY_TARGET[profile.pace] || '3-4'} activities/day)`,
      `Food: ${(profile.foodPreferences || []).join(', ') || 'no restrictions'}`,
    ],
    packing_reminders: [PLACEHOLDER],
  };
};

module.exports = { destinationIntelligence, itinerary, PLACEHOLDER };
