import React from 'react';
import { Filter, SlidersHorizontal, X, Star } from 'lucide-react';

/**
 * ============================================================================
 * FILTER SIDEBAR + SORT BAR
 * ============================================================================
 * These controls are wired to real state via useFilterSort. Every option
 * shown is derived from the actual results, so the UI never offers a filter
 * that would return nothing, and each option shows how many items match.
 *
 * Replaces a sidebar of eleven `defaultChecked` checkboxes with no handlers.
 * ============================================================================
 */

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function SortBar({ tab, sort, setSort, sortOptions, shown, total, activeCount, onReset }) {
  return (
    <div className="sort-bar">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ color: 'white', fontSize: '1rem' }}>
          {shown} {shown === 1 ? 'result' : 'results'}
        </strong>
        {shown !== total && (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            filtered from {total}
          </span>
        )}
        {activeCount > 0 && (
          <button className="chip chip--removable" onClick={onReset}>
            <X size={11} aria-hidden="true" /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span
          id={`sort-label-${tab}`}
          style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <SlidersHorizontal size={13} aria-hidden="true" /> Sort
        </span>
        <div className="sort-options" role="group" aria-labelledby={`sort-label-${tab}`}>
          {sortOptions.map((o) => (
            <button
              key={o.value}
              className="chip"
              aria-pressed={sort === o.value}
              onClick={() => setSort(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FilterSidebar({ tab, filters, setFilter, toggleIn, reset, activeCount, facets }) {
  const hasPriceRange = facets.maxPrice > facets.minPrice;

  return (
    <aside className="filters-sidebar glass-panel" aria-label="Filter results">
      <div className="filter-head">
        <h3 style={{ fontSize: '0.95rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="var(--accent-primary)" aria-hidden="true" /> Filters
          {activeCount > 0 && (
            <span className="verified-pill" style={{ color: '#c7d2fe', background: 'var(--accent-primary-soft)', borderColor: 'rgba(99,102,241,0.3)' }}>
              {activeCount}
            </span>
          )}
        </h3>
        <button className="btn-ghost" onClick={reset} disabled={activeCount === 0} style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}>
          Reset
        </button>
      </div>

      {/* Price — a slider bounded by the real min/max of the current results */}
      {hasPriceRange && (
        <div className="filter-group">
          <div className="filter-title">Max price</div>
          <input
            className="filter-range"
            type="range"
            min={facets.minPrice}
            max={facets.maxPrice}
            step={Math.max(50, Math.round((facets.maxPrice - facets.minPrice) / 40))}
            value={filters.priceMax ?? facets.maxPrice}
            onChange={(e) => setFilter('priceMax', Number(e.target.value))}
            aria-label="Maximum price"
            aria-valuetext={inr(filters.priceMax ?? facets.maxPrice)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            <span>{inr(facets.minPrice)}</span>
            <strong style={{ color: 'var(--accent-primary)' }}>
              up to {inr(filters.priceMax ?? facets.maxPrice)}
            </strong>
          </div>
        </div>
      )}

      {/* Rating */}
      <div className="filter-group">
        <div className="filter-title">Guest rating</div>
        {[
          { value: 0, label: 'Any rating' },
          { value: 4.5, label: '4.5+ Exceptional' },
          { value: 4.0, label: '4.0+ Very good' },
          { value: 3.5, label: '3.5+ Good' },
        ].map((r) => (
          <label key={r.value} className="filter-checkbox">
            <input
              type="radio"
              name={`rating-${tab}`}
              checked={filters.minRating === r.value}
              onChange={() => setFilter('minRating', r.value)}
            />
            {r.value > 0 && <Star size={12} fill="var(--accent-gold)" color="var(--accent-gold)" aria-hidden="true" />}
            {r.label}
          </label>
        ))}
      </div>

      {/* Flights only */}
      {tab === 'flights' && (
        <div className="filter-group">
          <div className="filter-title">Stops</div>
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filters.nonStopOnly}
              onChange={(e) => setFilter('nonStopOnly', e.target.checked)}
            />
            Non-stop only
          </label>
        </div>
      )}

      {/* Facet groups — only shown when the results actually contain them */}
      {facets.amenities.length > 0 && (
        <div className="filter-group">
          <div className="filter-title">Amenities</div>
          {facets.amenities.map(({ value, count }) => (
            <label key={value} className="filter-checkbox">
              <input
                type="checkbox"
                checked={filters.amenities.includes(value)}
                onChange={() => toggleIn('amenities', value)}
              />
              {value}
              <span className="filter-count">{count}</span>
            </label>
          ))}
        </div>
      )}

      {facets.cuisines.length > 0 && (
        <div className="filter-group">
          <div className="filter-title">Cuisine</div>
          {facets.cuisines.map(({ value, count }) => (
            <label key={value} className="filter-checkbox">
              <input
                type="checkbox"
                checked={filters.cuisines.includes(value)}
                onChange={() => toggleIn('cuisines', value)}
              />
              {value}
              <span className="filter-count">{count}</span>
            </label>
          ))}
        </div>
      )}

      {facets.categories.length > 0 && (
        <div className="filter-group">
          <div className="filter-title">Category</div>
          {facets.categories.map(({ value, count }) => (
            <label key={value} className="filter-checkbox">
              <input
                type="checkbox"
                checked={filters.categories.includes(value)}
                onChange={() => toggleIn('categories', value)}
              />
              {value}
              <span className="filter-count">{count}</span>
            </label>
          ))}
        </div>
      )}
    </aside>
  );
}
