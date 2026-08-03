import React, { useId, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { X, MapPin, Utensils, Info, ChevronLeft, ChevronRight, Pause, Play, ImageOff } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

/**
 * ============================================================================
 * LANDMARK GALLERY
 * ============================================================================
 * Was a Pannellum 360° viewer. It looked terrible, for a reason that had
 * nothing to do with Pannellum: we were feeding it an ordinary flat photo.
 * An equirectangular viewer expects a 2:1 sphere projection, so a normal image
 * gets stretched across a globe — you'd see a blurry fragment of one monument
 * and nothing else, with no way to reach the rest of the city.
 *
 * What the feature actually wanted was a tour: Qutub Minar, then Lotus Temple,
 * then Jantar Mantar. That's a slideshow, not a sphere. Dropping the 360
 * projection fixes the resolution problem AND makes the multi-landmark
 * experience possible, while removing an unmaintained React-16-era dependency
 * and a runtime CDN load.
 *
 * The photos are real, sourced per landmark from Wikipedia by
 * `npm run fetch-images`. Landmarks we couldn't find a photo for are skipped
 * rather than padded with stock imagery — the same rule the itinerary
 * grounding follows.
 * ============================================================================
 */

const SLIDE_MS = 5000;

export default function VRDestinationModal({ destination, onClose }) {
  const titleId = useId();
  const dialogRef = useModalA11y(onClose);

  /**
   * Only landmarks with a real photo. A destination whose landmarks all
   * missed the Wikipedia lookup produces an empty list, and we show the
   * tinted fallback instead of broken image icons.
   */
  const slides = useMemo(() => {
    const seeded = destination?.seededFamousPlaces || destination?.famousPlaces || [];
    return seeded.filter((p) => p?.imageUrl);
  }, [destination]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(() => new Set());

  const visible = useMemo(
    () => slides.filter((_, i) => !failed.has(i)),
    [slides, failed]
  );
  const count = visible.length;

  const go = useCallback((delta) => {
    setIndex((i) => (count ? (i + delta + count) % count : 0));
  }, [count]);

  // Auto-advance. Resets whenever the index changes, so manually stepping
  // forward gives you a fresh 5 seconds rather than a stub of the old timer.
  useEffect(() => {
    if (paused || count < 2) return undefined;
    const t = setTimeout(() => go(1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused, count, go]);

  // Arrow keys. Escape is already handled by useModalA11y.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go]);

  // An index past the end after a failed image would render nothing at all.
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [index, count]);

  if (!destination) return null;

  const city = destination.cityName || destination.city || 'Destination';
  const current = visible[index];
  const tag = (destination.tags || [])[0] || 'generic';

  return (
    <div className="modal-backdrop" style={{ zIndex: 300, padding: 0 }}>
      <div
        ref={dialogRef}
        className="gallery"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <button type="button" className="gallery__close" onClick={onClose} aria-label={`Close ${city} gallery`}>
          <X size={22} aria-hidden="true" />
        </button>

        {/* ---------------------------------------------------------- stage */}
        {count > 0 ? (
          <>
            {/*
              All slides stay mounted and cross-fade via opacity. Swapping the
              src instead would show a white flash on every transition while
              the next image downloads.
            */}
            {visible.map((place, i) => (
              <img
                key={place.imageUrl}
                src={place.imageUrl}
                alt={i === index ? `${place.name}, ${city}` : ''}
                aria-hidden={i !== index}
                className={`gallery__slide${i === index ? ' gallery__slide--active' : ''}`}
                // The neighbours are prefetched; the rest wait.
                loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                onError={() => setFailed((f) => new Set(f).add(i))}
              />
            ))}
            <div className="gallery__scrim" />
          </>
        ) : (
          <div className={`gallery__empty dest-tile__banner dest-tile__banner--${tag}`}>
            <ImageOff size={34} aria-hidden="true" />
            <p>No photographs available for {city} yet</p>
            <span>
              Landmark photos come from Wikipedia. Rather than fill the gap with
              stock images of somewhere else, we show nothing.
            </span>
          </div>
        )}

        {/* ------------------------------------------------------- controls */}
        {count > 1 && (
          <>
            <button type="button" className="gallery__nav gallery__nav--prev" onClick={() => go(-1)} aria-label="Previous landmark">
              <ChevronLeft size={26} aria-hidden="true" />
            </button>
            <button type="button" className="gallery__nav gallery__nav--next" onClick={() => go(1)} aria-label="Next landmark">
              <ChevronRight size={26} aria-hidden="true" />
            </button>

            <div className="gallery__dots" role="tablist" aria-label="Landmarks">
              {visible.map((place, i) => (
                <button
                  key={place.imageUrl}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={place.name}
                  className={`gallery__dot${i === index ? ' gallery__dot--active' : ''}`}
                  onClick={() => setIndex(i)}
                >
                  {/* Fills over 5s so you can see when the next slide is due. */}
                  {i === index && !paused && <span className="gallery__dot-fill" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="gallery__pause"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'}
            >
              {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
            </button>
          </>
        )}

        {/* --------------------------------------------------------- caption */}
        {current && (
          <div className="gallery__caption" key={current.name}>
            <span className="gallery__counter">{index + 1} / {count}</span>
            <h3>{current.name}</h3>
            {current.category && <span className="gallery__category">{current.category}</span>}
            {/* CC licensing requires credit. */}
            {current.attribution && (
              <a
                className="gallery__credit"
                href={current.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {current.attribution}
              </a>
            )}
          </div>
        )}

        {/* ----------------------------------------------- destination panel */}
        <div className="vr-panel">
          <h2 id={titleId} style={{ fontSize: '1.7rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={21} color="var(--accent-primary)" aria-hidden="true" /> {city}
          </h2>
          <p style={{ color: '#a5b4fc', fontSize: '0.85rem', marginBottom: '1.15rem', fontWeight: 500 }}>
            {[destination.state, destination.country].filter(Boolean).join(', ')}
          </p>

          {destination.culture || destination.traditionsAndCulture ? (
            <div style={{ marginBottom: '1.15rem' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.98rem', marginBottom: '0.4rem', color: '#e2e8f0' }}>
                <Info size={15} aria-hidden="true" /> Culture
              </h4>
              <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                {destination.culture || destination.traditionsAndCulture}
              </p>
            </div>
          ) : null}

          {destination.famousFoods?.length > 0 && (
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.98rem', marginBottom: '0.5rem', color: '#e2e8f0' }}>
                <Utensils size={15} aria-hidden="true" /> Must-try dishes
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {destination.famousFoods.slice(0, 6).map((food, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'rgba(251,191,36,0.15)', color: '#fcd34d',
                      padding: '0.28rem 0.65rem', borderRadius: 'var(--radius-xs)',
                      fontSize: '0.75rem', fontWeight: 600,
                    }}
                  >
                    {typeof food === 'string' ? food : food.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
