import React, { useId, useEffect, useRef, useState } from 'react';
import { X, MapPin, Utensils, Info, Loader2, AlertCircle } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';
import { loadScript, loadStylesheet } from '../utils/loadExternal';

/**
 * 360° destination viewer.
 *
 * Two things worth knowing about this file:
 *
 * 1. ACCESSIBILITY. This was the worst case in the app: a full-viewport
 *    overlay with no dialog role, no focus trap and no Escape handler, so a
 *    keyboard user who opened it had no way out. It also put a 450px info
 *    panel over the viewer, which on a phone covered the whole experience —
 *    the panel is a bottom sheet on small screens now.
 *
 * 2. NO REACT WRAPPER. This used `pannellum-react`, which declares
 *    `peer react@16.x` and so refuses to install on React 19 — it broke the
 *    production build. That package was last published before React 17
 *    existed and pulled in video.js, 21MB of node_modules for one modal.
 *
 *    Pannellum itself is a plain UMD library. Driving it directly is about
 *    fifteen lines: create a div, hand it to `pannellum.viewer()`, call
 *    `.destroy()` on unmount. The wrapper was never earning its keep.
 */

const PANNELLUM_VERSION = '2.5.6';
const PANNELLUM_JS = `https://cdn.jsdelivr.net/npm/pannellum@${PANNELLUM_VERSION}/build/pannellum.js`;
const PANNELLUM_CSS = `https://cdn.jsdelivr.net/npm/pannellum@${PANNELLUM_VERSION}/build/pannellum.css`;

const FALLBACK_PANORAMA = 'https://pannellum.org/images/alma.jpg';

export default function VRDestinationModal({ destination, onClose }) {
  const titleId = useId();
  const dialogRef = useModalA11y(onClose);

  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  const panorama = destination?.vrImageUrl || FALLBACK_PANORAMA;

  useEffect(() => {
    // React 18+ StrictMode runs effects twice in development. Without this,
    // the second pass initialises a viewer over the first one's canvas.
    let cancelled = false;

    setStatus('loading');

    Promise.all([loadStylesheet(PANNELLUM_CSS), loadScript(PANNELLUM_JS)])
      .then(() => {
        if (cancelled || !containerRef.current) return;
        if (!window.pannellum) throw new Error('pannellum global missing after load');

        // Same configuration the old <Pannellum> props produced.
        viewerRef.current = window.pannellum.viewer(containerRef.current, {
          type: 'equirectangular',
          panorama,
          pitch: 10,
          yaw: 180,
          hfov: 110,
          autoLoad: true,
          autoRotate: -2,
          showZoomCtrl: false,
          showFullscreenCtrl: false,
          // Pannellum draws its own "loading" spinner; ours is nicer and
          // already matches the app.
          hotSpotDebug: false,
        });

        setStatus('ready');
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[VR] Pannellum failed to load:', err.message);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
      // WebGL contexts are a limited browser resource — a few leaked viewers
      // and every canvas on the page stops rendering. destroy() releases it.
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch {
          // Already torn down; nothing to do.
        }
        viewerRef.current = null;
      }
    };
  }, [panorama]);

  if (!destination) return null;

  const city = destination.cityName || destination.city || 'Destination';

  return (
    <div className="modal-backdrop" style={{ zIndex: 300, padding: 0 }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ position: 'relative', width: '100%', height: '100dvh', background: '#000' }}
      >
        <button
          onClick={onClose}
          aria-label={`Close 360 degree view of ${city}`}
          style={{
            position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 310,
            background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.22)',
            color: 'white', width: 46, height: 46, borderRadius: '50%', cursor: 'pointer',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={22} aria-hidden="true" />
        </button>

        {/* Pannellum takes over this element entirely. */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {status === 'loading' && (
          <div style={overlayStyle} role="status">
            <Loader2 size={30} className="spin" aria-hidden="true" />
            <p style={{ marginTop: '0.8rem', fontSize: '0.9rem' }}>Loading 360° view…</p>
          </div>
        )}

        {status === 'error' && (
          <div style={overlayStyle} role="alert">
            <AlertCircle size={30} color="var(--danger)" aria-hidden="true" />
            <p style={{ marginTop: '0.8rem', fontSize: '0.95rem', fontWeight: 600 }}>
              The 360° viewer couldn&apos;t load
            </p>
            <p style={{ marginTop: '0.3rem', fontSize: '0.82rem', color: '#94a3b8', maxWidth: 300, textAlign: 'center' }}>
              The panorama library is served from a CDN that isn&apos;t reachable right now.
              Everything else on this page still works.
            </p>
          </div>
        )}

        {/* Overlay panel on desktop; bottom sheet on mobile. */}
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

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#000',
  color: '#e2e8f0',
  // Must not swallow clicks on the close button above it.
  pointerEvents: 'none',
  zIndex: 305,
  padding: '1.5rem',
};
