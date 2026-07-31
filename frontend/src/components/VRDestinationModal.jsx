import React, { useId } from 'react';
import { Pannellum } from 'pannellum-react';
import { X, MapPin, Utensils, Info } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

/**
 * 360° destination viewer.
 *
 * This was the worst accessibility case in the app: a full-viewport overlay
 * with no dialog role, no focus trap and no Escape handler, so a keyboard user
 * who opened it had no way out. It also placed a 450px info panel over the
 * viewer, which on a phone covered the entire experience — the panel now
 * becomes a bottom sheet on small screens.
 */
export default function VRDestinationModal({ destination, onClose }) {
  const titleId = useId();
  const dialogRef = useModalA11y(onClose);

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

        <Pannellum
          width="100%"
          height="100%"
          image={destination.vrImageUrl || 'https://pannellum.org/images/alma.jpg'}
          pitch={10}
          yaw={180}
          hfov={110}
          autoLoad
          showZoomCtrl={false}
          showFullscreenCtrl={false}
          autoRotate={-2}
        />

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
