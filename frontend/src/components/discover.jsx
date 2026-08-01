import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, History, Hotel, Utensils, MapPin, Loader2, Navigation2,
} from 'lucide-react';
import { discover, library } from '../api/client';
import { HotelCard, RestaurantCard, PlaceCard } from './cards';
import { EmptyState } from './states';
// Same chunk as the itinerary's map — Vite reuses it, so opening a map here
// after viewing one there costs no second download.
const MapView = lazy(() => import('./MapView'));

/**
 * ============================================================================
 * DISCOVERY WIDGETS
 * ============================================================================
 * Nearby (hotels / restaurants / attractions), personalised recommendations,
 * and recently viewed destinations.
 *
 * All three answer "what should I look at next", which is what makes the app
 * feel connected rather than a set of separate search pages.
 * ============================================================================
 */

const NEARBY_TABS = [
  { id: 'hotel', label: 'Hotels', icon: Hotel, key: 'hotel' },
  { id: 'restaurant', label: 'Restaurants', icon: Utensils, key: 'restaurant' },
  { id: 'place', label: 'Attractions', icon: MapPin, key: 'place' },
];

/* ------------------------------------------------------------------ nearby */

export function NearbyPanel({ lat, lng, title = 'Nearby' }) {
  const [tab, setTab] = useState('hotel');
  const [radius, setRadius] = useState(5);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    let alive = true;
    setLoading(true);
    discover.nearby({ lat, lng, radiusKm: radius, limit: 8 })
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [lat, lng, radius]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const items = data?.[tab] || [];

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h4 style={{ color: 'white', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Navigation2 size={17} color="var(--accent-teal)" aria-hidden="true" /> {title}
        </h4>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="nearby-radius" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Within {radius} km
          </label>
          <input
            id="nearby-radius"
            className="filter-range"
            style={{ width: 100 }}
            type="range" min="1" max="25" step="1"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </div>
      </div>

      <div role="tablist" aria-label="Nearby categories" style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {NEARBY_TABS.map(({ id, label, icon: Icon, key }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className="chip"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon size={12} aria-hidden="true" /> {label}
            {data?.[key] ? <span style={{ opacity: 0.7 }}>({data[key].length})</span> : null}
          </button>
        ))}
        <button
          className="chip"
          aria-pressed={view === 'map'}
          onClick={() => setView(view === 'map' ? 'list' : 'map')}
          style={{ marginLeft: 'auto' }}
        >
          {view === 'map' ? 'List' : 'Map'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Loader2 size={22} className="spin" color="var(--accent-primary)" aria-hidden="true" />
        </div>
      ) : !items.length ? (
        <EmptyState
          title={`Nothing within ${radius} km`}
          message="Widen the radius to search a larger area."
        />
      ) : view === 'map' ? (
        <Suspense fallback={<div className="map-loading"><Loader2 size={22} className="spin" /> Loading map…</div>}>
          <MapView items={items} type={tab} />
        </Suspense>
      ) : (
        <div className="cards-grid" aria-live="polite">
          {items.map((item, i) => {
            const badge = (
              <span className="tag" style={{ color: 'var(--accent-teal)' }}>
                {item.distanceKm} km away
              </span>
            );
            if (tab === 'hotel') return <div key={item._id}><HotelCard hotel={item} index={i} />{badge}</div>;
            if (tab === 'restaurant') return <RestaurantCard key={item._id} restaurant={item} index={i} />;
            return <PlaceCard key={item._id} place={item} index={i} />;
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- recommendations */

export function Recommendations({ limit = 6 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    discover.recommendations(limit)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [limit]);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div className="skeleton-pulse" style={{ height: 130, borderRadius: 'var(--radius-sm)' }} />
      </div>
    );
  }
  if (!data?.items?.length) return null;

  return (
    <section className="glass-panel" style={{ padding: '1.5rem' }} aria-labelledby="recs-title">
      <div style={{ marginBottom: '1.1rem' }}>
        <h3 id="recs-title" style={{ color: 'white', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={17} color="var(--accent-secondary)" aria-hidden="true" /> Recommended for you
        </h3>
        {/* Explaining WHY makes a recommendation trustworthy instead of arbitrary. */}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {data.reason}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.9rem' }}>
        {data.items.map((d, i) => (
          <Link
            key={d.citySlug}
            to={`/destination/${d.citySlug}`}
            className="glass-panel glass-panel-hover fade-in-up dest-tile"
            style={{
              padding: 0, overflow: 'hidden', textDecoration: 'none',
              display: 'block', animationDelay: `${i * 45}ms`,
            }}
          >
            {/*
              A tinted panel, not a photograph.
              This used to be a stock image picked by tag, which illustrated
              Delhi with the Taj Mahal — a building in Agra, 200km away. We
              have no real photo of each city, so showing one that implies we
              do is worse than showing none. The tint encodes the destination
              type, and the text underneath is all curated fact.
            */}
            <div className={`dest-tile__banner dest-tile__banner--${(d.tags || [])[0] || 'generic'}`}>
              <span className="dest-tile__initial" aria-hidden="true">
                {d.cityName?.trim().charAt(0).toUpperCase()}
              </span>
            </div>

            <div style={{ padding: '0.85rem' }}>
              <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>{d.cityName}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: '0.45rem' }}>
                {[d.state, d.country].filter(Boolean).join(', ')}
              </div>

              {/* A real landmark from the seed data, so the card says something
                  true about the place instead of decorating it. */}
              {d.topSight && (
                <div className="dest-tile__sight" title={d.topSight}>
                  <MapPin size={12} aria-hidden="true" />
                  <span>{d.topSight}</span>
                </div>
              )}

              <div className="tag-row">
                {(d.tags || []).slice(0, 2).map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------- recently viewed */

export function RecentlyViewed() {
  const [items, setItems] = useState([]);

  const load = useCallback(() => {
    library.recentlyViewed()
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!items.length) return null;

  return (
    <section aria-labelledby="recent-title" style={{ marginBottom: '1.5rem' }}>
      <h3 id="recent-title" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <History size={13} aria-hidden="true" /> Recently viewed
      </h3>

      {/* Horizontal scroller — recency is a glanceable strip, not a grid. */}
      <div style={{ display: 'flex', gap: '0.65rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
        {items.map((it) => (
          <Link
            key={it.refId}
            to={`/destination/${it.refId}`}
            className="glass-panel glass-panel-hover"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.5rem 0.85rem 0.5rem 0.5rem', textDecoration: 'none',
              flexShrink: 0, borderRadius: 'var(--radius-full)',
            }}
          >
            {/* Destinations have no photo (see library.service buildSnapshot),
                so they get a tag-tinted initial instead of a broken image. */}
            {it.snapshot?.image ? (
              <img
                src={it.snapshot.image}
                alt=""
                loading="lazy"
                style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <span
                className={`dest-tile__banner dest-tile__banner--${(it.snapshot?.tags || [])[0] || 'generic'}`}
                aria-hidden="true"
                style={{ width: 30, height: 30, borderRadius: '50%', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}
              >
                {it.snapshot?.name?.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {it.snapshot?.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
