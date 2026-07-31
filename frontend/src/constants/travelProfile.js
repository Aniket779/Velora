/** Mirror of backend/src/constants/travelProfile.js. Keep in sync (roadmap M5). */

export const BUDGET_TIERS = [
  { value: 'budget', label: 'Budget-friendly', hint: 'Guesthouses, local eats' },
  { value: 'moderate', label: 'Moderate', hint: 'Comfortable mid-range' },
  { value: 'luxury', label: 'Luxury', hint: 'Premium stays, fine dining' },
];

export const TRAVELLER_TYPES = [
  { value: 'solo', label: 'Solo', icon: '🧍' },
  { value: 'couple', label: 'Couple', icon: '💑' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧' },
  { value: 'group', label: 'Group', icon: '👥' },
];

export const ADVENTURE_LEVELS = [
  { value: 'low', label: 'Relaxed', hint: 'Museums, gardens, easy walks' },
  { value: 'moderate', label: 'Active', hint: 'Cycling, snorkelling, light treks' },
  { value: 'high', label: 'Adventurous', hint: 'Trekking, diving, paragliding' },
];

export const PACE_OPTIONS = [
  { value: 'relaxed', label: 'Relaxed', hint: '2-3 per day' },
  { value: 'balanced', label: 'Balanced', hint: '3-4 per day' },
  { value: 'packed', label: 'Packed', hint: '5-6 per day' },
];

export const INTERESTS = [
  'history', 'culture', 'food', 'nature', 'adventure', 'nightlife', 'shopping',
  'beaches', 'photography', 'spirituality', 'wildlife', 'art', 'architecture', 'wellness',
];

export const FOOD_PREFERENCES = [
  { value: 'no-restrictions', label: 'No restrictions' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'jain', label: 'Jain' },
  { value: 'halal', label: 'Halal' },
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'seafood-lover', label: 'Seafood lover' },
  { value: 'street-food', label: 'Street food' },
  { value: 'fine-dining', label: 'Fine dining' },
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
