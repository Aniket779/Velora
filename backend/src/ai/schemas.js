'use strict';

/**
 * ============================================================================
 * WHAT THIS FILE DOES
 * ============================================================================
 * Defines the exact shape of the JSON we want back from OpenAI, in two places:
 *
 *   1. Zod schemas  -> validate the response at runtime (in JavaScript)
 *   2. JSON Schema  -> sent to OpenAI so it CANNOT return the wrong shape
 *
 * WHY IT MATTERS
 * The old code sent `JSON.stringify(Schema.shape)` to OpenAI, which produced
 * an empty object. The AI was being shown nothing and guessing the format.
 * Zod v4 can convert itself to real JSON Schema, so now OpenAI is given a
 * proper contract and physically cannot break it. This is called
 * "structured outputs".
 *
 * RULE: use .nullable() and never .optional(). OpenAI's strict mode requires
 * every field to be present; nullable means "can be empty" while still
 * being present.
 * ============================================================================
 */

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Helper: turn a Zod schema into the payload OpenAI expects
// ---------------------------------------------------------------------------

/** Keys OpenAI's validator rejects, so we strip them out. */
const UNSUPPORTED = [
  '$schema', '$id', 'default', 'format', 'minLength', 'maxLength',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'multipleOf', 'minItems', 'maxItems', 'uniqueItems', 'pattern',
  'contentEncoding', 'contentMediaType',
];

const clean = (node) => {
  if (Array.isArray(node)) return node.map(clean);
  if (node === null || typeof node !== 'object') return node;

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (!UNSUPPORTED.includes(key)) out[key] = clean(value);
  }

  // OpenAI strict mode: objects must forbid extra keys and require every field.
  if (out.type === 'object' && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
};

const toOpenAISchema = (zodSchema, name) => ({
  name,
  strict: true,
  schema: clean(z.toJSONSchema(zodSchema, { target: 'draft-2020-12' })),
});

// ---------------------------------------------------------------------------
// SCHEMA 1: Destination intelligence (the 18 knowledge categories)
// Generated once per city, then cached in MongoDB.
// ---------------------------------------------------------------------------

const DestinationIntelligenceSchema = z.object({
  country: z.string(),
  oneLineSummary: z.string(),

  history: z.string(),
  culture: z.string(),
  traditions: z.array(z.string()),

  famousFoods: z.array(z.object({
    name: z.string(),
    description: z.string(),
    whereToTry: z.string(),
    vegetarian: z.boolean(),
  })),

  festivals: z.array(z.object({
    name: z.string(),
    months: z.string(),
    description: z.string(),
  })),

  famousPlaces: z.array(z.object({
    name: z.string(),
    whyVisit: z.string(),
  })),

  hiddenGems: z.array(z.object({
    name: z.string(),
    whyVisit: z.string(),
    howToReach: z.string(),
  })),

  localExperiences: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),

  transportation: z.object({
    gettingAround: z.string(),
    fromAirport: z.string(),
    options: z.array(z.object({
      mode: z.string(),
      typicalCost: z.string(),
      tips: z.string(),
    })),
  }),

  shopping: z.object({
    whatToBuy: z.array(z.string()),
    markets: z.array(z.object({ name: z.string(), knownFor: z.string() })),
    bargainingTips: z.string(),
  }),

  weather: z.object({
    overview: z.string(),
    seasons: z.array(z.object({
      season: z.string(),
      months: z.string(),
      temperatureRange: z.string(),
      description: z.string(),
    })),
  }),

  bestSeason: z.object({
    recommendedMonths: z.string(),
    why: z.string(),
    monthsToAvoid: z.string(),
  }),

  safetyTips: z.array(z.string()),

  scamsToAvoid: z.array(z.object({
    scam: z.string(),
    howItWorks: z.string(),
    howToAvoid: z.string(),
  })),

  emergencyNumbers: z.array(z.object({
    service: z.string(),
    number: z.string(),
  })),

  localEtiquette: z.object({
    dos: z.array(z.string()),
    donts: z.array(z.string()),
    dressCode: z.string(),
    tipping: z.string(),
  }),

  budgetEstimation: z.object({
    currency: z.string(),
    notes: z.string(),
    dailyByTier: z.array(z.object({
      tier: z.enum(['budget', 'moderate', 'luxury']),
      accommodation: z.number(),
      food: z.number(),
      localTransport: z.number(),
      activities: z.number(),
      totalPerPersonPerDay: z.number(),
    })),
  }),

  packingSuggestions: z.object({
    essentials: z.array(z.string()),
    seasonal: z.array(z.string()),
    documents: z.array(z.string()),
  }),
});

// ---------------------------------------------------------------------------
// SCHEMA 2: The day-by-day itinerary
//
// KEY FIELD: `ref`
// This is the short code (H1, R2, P3, F1) of a REAL hotel/restaurant/place/
// flight we pulled from MongoDB and showed to the AI. The AI must pick from
// our list instead of inventing places. `ref` is null only for things with no
// database record ("walk on the beach", "check out of hotel").
//
// We use short codes instead of MongoDB _id strings because an _id is 24
// characters (~12 tokens) and easy for the AI to mistype. "H1" is 1 token.
// ---------------------------------------------------------------------------

const ACTIVITY_TYPES = ['hotel', 'food', 'activity', 'transit', 'shopping', 'experience', 'rest'];

const GroundedItinerarySchema = z.object({
  trip_title: z.string(),
  summary: z.string(),
  days: z.array(z.object({
    day_number: z.number(),
    theme: z.string(),
    daily_budget_estimate_inr: z.number(),
    notes: z.string(),
    activities: z.array(z.object({
      title: z.string(),
      type: z.enum(ACTIVITY_TYPES),
      ref: z.string().nullable(),          // <-- the grounding link
      location_name: z.string(),
      start_time: z.string(),
      end_time: z.string(),
      duration_minutes: z.number(),
      description: z.string(),
      why_chosen: z.string(),              // ties the choice to the traveller
      estimated_cost_inr: z.number(),
      booking_required: z.boolean(),
      travel_from_previous: z.string(),
    })),
  })),
  total_estimated_cost_inr: z.number(),
  personalisation_notes: z.array(z.string()),
  packing_reminders: z.array(z.string()),
});

module.exports = {
  ACTIVITY_TYPES,

  DestinationIntelligenceSchema,
  GroundedItinerarySchema,

  DESTINATION_INTELLIGENCE_JSON_SCHEMA: toOpenAISchema(
    DestinationIntelligenceSchema, 'destination_intelligence'
  ),
  ITINERARY_JSON_SCHEMA: toOpenAISchema(
    GroundedItinerarySchema, 'grounded_itinerary'
  ),
};
