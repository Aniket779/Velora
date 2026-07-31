import React, { useState, useId } from 'react';
import { CheckCircle2, X, ShieldCheck, Ticket, AlertTriangle, Copy, Check } from 'lucide-react';
import { library } from '../api/client';
import { useLibrary } from '../hooks/useLibrary';
import { useAuth } from '../hooks/useAuth';
import { useModalA11y } from '../hooks/useModalA11y';

/**
 * ============================================================================
 * BOOKING MODAL
 * ============================================================================
 * IMPORTANT CHANGE: this used to fabricate a successful booking when the API
 * call failed. The catch block generated a fake reference number and showed
 * "Booking Confirmed!" for a reservation that existed nowhere. That is the
 * single most user-hostile thing the app did, and it is gone — a failed
 * request now shows a failure with a retry.
 *
 * Bookings are still a demo flow: the server returns a reference but does not
 * persist anything or take payment. The UI says so rather than implying
 * otherwise.
 * ============================================================================
 */
export default function BookingModal({ bookingItem, itineraryId, onClose }) {
  const [status, setStatus] = useState('idle');   // idle | loading | done | error
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const titleId = useId();
  const dialogRef = useModalA11y(onClose);
  const { refresh } = useLibrary();
  const { isAuthenticated, openAuth } = useAuth();

  const amount = Number(bookingItem?.amount || 0);
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const confirmBooking = async () => {
    // Gated here rather than at each of the places that can open this modal —
    // one check covers every entry point, and a guest can still browse the
    // price breakdown before being asked to sign up.
    if (!isAuthenticated) {
      onClose();
      openAuth('register', 'Create a free account to confirm this booking.');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      // Note: `amount` is NOT sent. The server derives the price from the
      // referenced inventory item, so a tampered client price is impossible.
      const booking = await library.book({
        serviceType: bookingItem.serviceType,
        itemId: bookingItem.id,
        itineraryId,
      });

      if (!booking?.referenceId) throw new Error('The server did not confirm this booking.');

      setConfirmation(booking);
      setStatus('done');
      refresh();   // booking count in the library updates immediately
    } catch (err) {
      // No fabricated success. If it failed, say it failed.
      setError(
        err?.response?.data?.message ||
        err.message ||
        'We could not reach the booking service.'
      );
      setStatus('error');
    }
  };

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(confirmation.referenceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable — the reference is visible anyway */ }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.35rem' }}>
          <h3 id={titleId} style={{ fontSize: '1.2rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Ticket size={19} color="var(--accent-primary)" aria-hidden="true" />
            {status === 'done' ? 'Booking confirmed' : 'Confirm booking'}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close booking dialog">
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {status !== 'done' ? (
          <div>
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-sm)',
                padding: '1.15rem',
                marginBottom: '1.25rem',
              }}
            >
              <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 700 }}>
                {bookingItem.serviceType}
              </p>
              <h4 style={{ fontSize: '1.05rem', color: 'white', marginBottom: '0.9rem' }}>
                {bookingItem.title}
              </h4>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass-light)', paddingTop: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Total payable</span>
                <span className="card-price">{fmt(amount)}</span>
              </div>
            </div>

            {status === 'error' && (
              <div
                role="alert"
                style={{
                  display: 'flex', gap: '0.7rem', alignItems: 'flex-start',
                  background: 'var(--danger-soft)', border: '1px solid rgba(251,113,133,0.3)',
                  borderRadius: 'var(--radius-sm)', padding: '0.9rem', marginBottom: '1.15rem',
                }}
              >
                <AlertTriangle size={17} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <div>
                  <strong style={{ color: '#fda4af', fontSize: '0.88rem', display: 'block', marginBottom: 2 }}>
                    Booking failed
                  </strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>{error}</span>
                </div>
              </div>
            )}

            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-teal)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              <ShieldCheck size={15} aria-hidden="true" /> Free cancellation up to 24 hours before
            </p>

            <button
              className="btn-primary"
              onClick={confirmBooking}
              disabled={status === 'loading'}
              style={{ width: '100%', padding: '0.9rem' }}
            >
              {status === 'loading'
                ? 'Processing…'
                : status === 'error'
                  ? 'Try again'
                  : `Confirm & pay ${fmt(amount)}`}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }} aria-live="polite">
            <div className="state-icon" style={{ background: 'var(--success-soft)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <CheckCircle2 size={28} color="var(--success)" aria-hidden="true" />
            </div>

            <h3 className="state-title">You're booked</h3>
            <p className="state-body" style={{ marginBottom: '1.25rem' }}>
              Your reservation reference is below.
            </p>

            <div
              style={{
                background: 'var(--success-soft)',
                border: '1px dashed var(--success)',
                borderRadius: 'var(--radius-sm)',
                padding: '1.1rem',
                marginBottom: '1.25rem',
                textAlign: 'left',
              }}
            >
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Booking reference
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.3rem 0 0.6rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', letterSpacing: '0.04em', fontFamily: 'Outfit, sans-serif' }}>
                  {confirmation.referenceId}
                </span>
                <button className="btn-icon" onClick={copyRef} aria-label="Copy booking reference" style={{ width: 32, height: 32 }}>
                  {copied ? <Check size={14} color="var(--success)" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'white' }}>{confirmation.title}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{fmt(confirmation.amount)}</p>
            </div>

            {/* Honest about what this actually is. */}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Demo booking — saved to your history, but no payment was taken and no
              reservation was made with a provider.
            </p>

            <button className="btn-primary" onClick={onClose} style={{ width: '100%' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
