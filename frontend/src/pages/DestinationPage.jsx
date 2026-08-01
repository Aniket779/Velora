import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Sparkles, Loader2 } from 'lucide-react';
import { catalog } from '../api/client';
import { useLibrary } from '../hooks/useLibrary';
import { BudgetCalculator, WeatherPanel } from '../components/planning';
import { NearbyPanel } from '../components/discover';
import { ErrorState } from '../components/states';

/**
 * ============================================================================
 * DESTINATION PAGE
 * ============================================================================
 * The hub that ties the feature set together for one city: weather, budget,
 * what's nearby, favourite it, plan a trip there.
 *
 * Visiting this page records a "recently viewed" entry, which is what feeds
 * the recently-viewed strip and the recommendation engine. That's the loop
 * that makes the app feel like it remembers you.
 * ============================================================================
 */
export default function DestinationPage() {
  const { citySlug } = useParams();
  const { recordView, isFavorite, toggleFavorite } = useLibrary();

  const [dest, setDest] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    catalog.destinations({ city: citySlug.replace(/-/g, ' ') })
      .then((list) => {
        if (!alive) return;
        const match = list.find((d) => d.citySlug === citySlug) || list[0];
        if (!match) throw new Error('not found');
        setDest(match);
        // Fire-and-forget — feeds Recently Viewed and recommendations.
        recordView(match.citySlug);
      })
      .catch(() => alive && setError('We could not find that destination.'))
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [citySlug, recordView]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 size={26} className="spin" color="var(--accent-primary)" aria-hidden="true" />
      </div>
    );
  }
  if (error || !dest) return <ErrorState title="Destination not found" message={error} />;

  const fav = isFavorite('destination', dest.citySlug);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Link to="/" className="btn-ghost" style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={15} aria-hidden="true" /> Back
      </Link>

      {/* Hero */}
      <div
        className="glass-panel"
        style={{
          padding: 0, overflow: 'hidden', marginBottom: '1.5rem', position: 'relative',
        }}
      >
        {/*
          Tinted banner, not a photograph — same reasoning as the destination
          tiles. This showed vrImageUrl, a stock image picked by tag, so
          Delhi's page was headed by a photo of somewhere else entirely.
          We have no real photo per city; implying we do is the lie.
        */}
        <div
          className={`dest-tile__banner dest-tile__banner--${(dest.tags || [])[0] || 'generic'}`}
          style={{ height: 220 }}
        >
          <span className="dest-tile__initial" style={{ fontSize: '5rem' }} aria-hidden="true">
            {dest.cityName?.trim().charAt(0).toUpperCase()}
          </span>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', marginBottom: '0.3rem' }}>
                {dest.cityName}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                {[dest.state, dest.country].filter(Boolean).join(', ')}
                {dest.bestSeason && <> · Best: {dest.bestSeason}</>}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-icon"
                style={{ color: fav ? 'var(--danger)' : undefined }}
                aria-pressed={fav}
                aria-label={fav ? `Remove ${dest.cityName} from favourites` : `Add ${dest.cityName} to favourites`}
                onClick={() => toggleFavorite('destination', dest.citySlug)}
              >
                <Heart size={17} fill={fav ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
              <Link to={`/?destination=${encodeURIComponent(dest.cityName)}`} className="btn-primary" style={{ padding: '0.6rem 1.3rem', fontSize: '0.88rem' }}>
                <Sparkles size={15} aria-hidden="true" /> Plan a trip
              </Link>
            </div>
          </div>

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: '1rem', fontSize: '0.93rem' }}>
            {dest.description}
          </p>

          {dest.tags?.length > 0 && (
            <div className="tag-row" style={{ marginTop: '0.85rem' }}>
              {dest.tags.map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Planning tools */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <WeatherPanel citySlug={dest.citySlug} />
        <BudgetCalculator citySlug={dest.citySlug} />
      </div>

      {/* Nearby — the three "nearby X" features, one component */}
      <NearbyPanel
        lat={dest.latitude}
        lng={dest.longitude}
        title={`Around ${dest.cityName}`}
      />
    </div>
  );
}
