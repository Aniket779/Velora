import { useMemo, useState, useCallback } from 'react';

/**
 * ============================================================================
 * FILTERING + SORTING
 * ============================================================================
 * The filter sidebar used to be eleven checkboxes rendered with
 * `defaultChecked` and no onChange handler. They looked interactive, responded
 * to clicks, and did absolutely nothing. This hook is the logic that makes
 * them real.
 *
 * Filtering runs client-side over the current result page. That's the honest
 * scope: it's fast, it needs no API changes, and for a page of 30 results it's
 * the right call. Server-side filtering across the whole 12,000-record
 * dataset would be the next step.
 * ============================================================================
 */

export const SORT_OPTIONS = {
  flights: [
    { value: 'price-asc', label: 'Cheapest' },
    { value: 'duration-asc', label: 'Fastest' },
    { value: 'departure-asc', label: 'Earliest' },
  ],
  hotels: [
    { value: 'rating-desc', label: 'Top rated' },
    { value: 'price-asc', label: 'Price: low to high' },
    { value: 'price-desc', label: 'Price: high to low' },
  ],
  restaurants: [
    { value: 'rating-desc', label: 'Top rated' },
    { value: 'price-asc', label: 'Cheapest' },
  ],
  places: [
    { value: 'rating-desc', label: 'Top rated' },
    { value: 'name-asc', label: 'A–Z' },
  ],
  cabs: [
    { value: 'price-asc', label: 'Cheapest' },
    { value: 'rating-desc', label: 'Top rated' },
  ],
};

const DEFAULT_SORT = {
  flights: 'price-asc',
  hotels: 'rating-desc',
  restaurants: 'rating-desc',
  places: 'rating-desc',
  cabs: 'price-asc',
};

/** Reads whichever price field this entity type uses. */
const priceOf = (item) =>
  item.pricePerNight ?? item.priceForTwo ?? item.price ?? item.entryFeeInr ?? 0;

/** "2h 35m" -> 155. Falls back to the numeric field when present. */
const durationMinutes = (item) => {
  if (typeof item.durationMinutes === 'number') return item.durationMinutes;
  const m = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/.exec(item.duration || '');
  return (Number(m?.[1] || 0) * 60) + Number(m?.[2] || 0);
};

const timeMinutes = (t = '') => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

export const emptyFilters = () => ({
  priceMax: null,
  minRating: 0,
  nonStopOnly: false,
  amenities: [],
  cuisines: [],
  categories: [],
});

export function useFilterSort(items, tab) {
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState(DEFAULT_SORT[tab] || 'rating-desc');

  // Derived from the actual results, so the UI only ever offers filters that
  // can return something.
  const facets = useMemo(() => {
    const prices = items.map(priceOf).filter((p) => p > 0);
    const amenities = new Map();
    const cuisines = new Map();
    const categories = new Map();

    for (const item of items) {
      for (const a of item.amenities || []) amenities.set(a, (amenities.get(a) || 0) + 1);
      const cs = Array.isArray(item.cuisine) ? item.cuisine : [item.cuisine].filter(Boolean);
      for (const c of cs) cuisines.set(c, (cuisines.get(c) || 0) + 1);
      if (item.category) categories.set(item.category, (categories.get(item.category) || 0) + 1);
    }

    const top = (map, n) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([value, count]) => ({ value, count }));

    return {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      amenities: top(amenities, 6),
      cuisines: top(cuisines, 6),
      categories: top(categories, 6),
    };
  }, [items]);

  const filtered = useMemo(() => {
    let out = items.filter((item) => {
      if (filters.priceMax != null && priceOf(item) > filters.priceMax) return false;
      if (filters.minRating > 0 && (item.rating ?? item.driverRating ?? 0) < filters.minRating) return false;
      if (filters.nonStopOnly && (item.stops ?? 0) !== 0) return false;

      if (filters.amenities.length) {
        const has = item.amenities || [];
        if (!filters.amenities.every((a) => has.includes(a))) return false;
      }
      if (filters.cuisines.length) {
        const cs = Array.isArray(item.cuisine) ? item.cuisine : [item.cuisine].filter(Boolean);
        if (!filters.cuisines.some((c) => cs.includes(c))) return false;
      }
      if (filters.categories.length && !filters.categories.includes(item.category)) return false;

      return true;
    });

    const [key, dir] = sort.split('-');
    const sign = dir === 'desc' ? -1 : 1;

    out = [...out].sort((a, b) => {
      switch (key) {
        case 'price': return (priceOf(a) - priceOf(b)) * sign;
        case 'rating': return ((a.rating ?? a.driverRating ?? 0) - (b.rating ?? b.driverRating ?? 0)) * sign;
        case 'duration': return (durationMinutes(a) - durationMinutes(b)) * sign;
        case 'departure': return (timeMinutes(a.departureTime || a.departure) - timeMinutes(b.departureTime || b.departure)) * sign;
        case 'name': return String(a.name || a.hotelName || '').localeCompare(String(b.name || b.hotelName || '')) * sign;
        default: return 0;
      }
    });

    return out;
  }, [items, filters, sort]);

  const toggleIn = useCallback((key, value) => {
    setFilters((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });
  }, []);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setFilters(emptyFilters()), []);

  const activeCount =
    (filters.priceMax != null ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.nonStopOnly ? 1 : 0) +
    filters.amenities.length + filters.cuisines.length + filters.categories.length;

  return {
    filters, setFilter, toggleIn, reset, activeCount,
    sort, setSort,
    sortOptions: SORT_OPTIONS[tab] || SORT_OPTIONS.hotels,
    facets,
    results: filtered,
    total: items.length,
  };
}
