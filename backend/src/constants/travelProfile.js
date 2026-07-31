'use strict';

/**
 * The traveller profile is the input contract for adaptive generation.
 *
 * Previously the AI received four loose fields (destination, days, budget,
 * preferences) as a concatenated sentence. Every itinerary therefore looked the
 * same regardless of who asked for it. These enums define the dimensions the plan
 * must actually adapt to, and are shared by the request validator, the prompt
 * builder and the frontend form.
 */

const BUDGET_TIERS = Object.freeze(['budget', 'moderate', 'luxury']);

const TRAVELLER_TYPES = Object.freeze(['solo', 'couple', 'family', 'group']);

const ADVENTURE_LEVELS = Object.freeze(['low', 'moderate', 'high']);

const PACE_OPTIONS = Object.freeze(['relaxed', 'balanced', 'packed']);

const INTERESTS = Object.freeze([
  'history',
  'culture',
  'food',
  'nature',
  'adventure',
  'nightlife',
  'shopping',
  'beaches',
  'photography',
  'spirituality',
  'wildlife',
  'art',
  'architecture',
  'wellness',
]);

const FOOD_PREFERENCES = Object.freeze([
  'no-restrictions',
  'vegetarian',
  'vegan',
  'jain',
  'halal',
  'gluten-free',
  'seafood-lover',
  'street-food',
  'fine-dining',
]);

/**
 * Typical mid-range price for a destination, by its price tier (1 cheapest,
 * 5 most expensive). Tier 1 is a small Indian town, tier 5 is Zurich or Tokyo.
 *
 * Shared with the seed generators so generated prices and runtime filtering use
 * the same scale.
 */
const TIER_BASE = Object.freeze({
  hotelPerNight: { 1: 1400, 2: 2600, 3: 4500, 4: 9000, 5: 16000 },
  mealForTwo: { 1: 350, 2: 600, 3: 1100, 4: 2400, 5: 4200 },
});

/**
 * Budget tier -> price ceiling, as a MULTIPLE of the destination's typical price.
 *
 * These were originally absolute rupee caps (budget = under ₹3,500/night). That
 * worked for India and broke completely once international destinations were
 * added: nothing in Dubai or Zurich costs under ₹3,500, so the budget filter
 * matched zero hotels, silently fell back to unfiltered, and a budget traveller
 * was shown ₹37,000 suites.
 *
 * Relative multipliers make "budget" mean the same thing everywhere: the cheaper
 * end of what THIS destination actually offers.
 */
const BUDGET_BANDS = Object.freeze({
  budget: { hotelMultiplier: 0.8, mealMultiplier: 0.8, label: 'budget-conscious' },
  moderate: { hotelMultiplier: 1.8, mealMultiplier: 1.8, label: 'mid-range' },
  luxury: { hotelMultiplier: null, mealMultiplier: null, label: 'premium' },
});

/** Resolves a budget tier + destination price tier into absolute INR ceilings. */
const resolveBudgetCeilings = (budgetTier, priceTier = 3) => {
  const band = BUDGET_BANDS[budgetTier] || BUDGET_BANDS.moderate;
  const tier = TIER_BASE.hotelPerNight[priceTier] ? priceTier : 3;

  return {
    label: band.label,
    maxPricePerNight: band.hotelMultiplier
      ? Math.round(TIER_BASE.hotelPerNight[tier] * band.hotelMultiplier)
      : null,
    maxPriceForTwo: band.mealMultiplier
      ? Math.round(TIER_BASE.mealForTwo[tier] * band.mealMultiplier)
      : null,
  };
};

/** Rough activity count per day, before the model applies its own judgment. */
const PACE_ACTIVITY_TARGET = Object.freeze({
  relaxed: '2-3',
  balanced: '3-4',
  packed: '5-6',
});

const GROUP_SIZE_BY_TYPE = Object.freeze({
  solo: 1,
  couple: 2,
  family: 4,
  group: 6,
});

module.exports = {
  BUDGET_TIERS,
  TRAVELLER_TYPES,
  ADVENTURE_LEVELS,
  PACE_OPTIONS,
  INTERESTS,
  FOOD_PREFERENCES,
  BUDGET_BANDS,
  TIER_BASE,
  resolveBudgetCeilings,
  PACE_ACTIVITY_TARGET,
  GROUP_SIZE_BY_TYPE,
};
