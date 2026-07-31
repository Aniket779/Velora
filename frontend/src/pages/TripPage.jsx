import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Bookmark, Share2, Copy, Check, Loader2, Eye } from 'lucide-react';
import { library } from '../api/client';
import ItineraryDisplay from '../components/ItineraryDisplay';
import { TravelChecklist } from '../components/planning';
import { NearbyPanel } from '../components/discover';
import { ErrorState } from '../components/states';
import BookingModal from '../components/BookingModal';

/**
 * ============================================================================
 * TRIP PAGE  (owner view)  and  SHARED TRIP PAGE  (public view)
 * ============================================================================
 * Both render the same itinerary. The difference is what surrounds it:
 * the owner gets save/share controls and a checklist; a visitor following a
 * share link gets a read-only view with no owner identity attached.
 * ============================================================================
 */

export default function TripPage({ shared = false }) {
  const { id, token } = useParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [bookingItem, setBookingItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = shared ? await library.shared(token) : await library.get(id);
      setTrip(data);
      if (data.shareToken) setShareUrl(`${window.location.origin}/shared/${data.shareToken}`);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || 'This trip could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id, token, shared]);

  useEffect(() => { load(); }, [load]);

  const toggleSave = async () => {
    setTrip((t) => ({ ...t, isSaved: !t.isSaved }));
    try { await library.save(id, !trip.isSaved); } catch { load(); }
  };

  const share = async () => {
    try {
      const res = await library.share(id);
      const url = `${window.location.origin}/shared/${res.shareToken}`;
      setShareUrl(url);
      setTrip((t) => ({ ...t, shareToken: res.shareToken }));
    } catch { /* handled by the error state on next load */ }
  };

  const unshare = async () => {
    try {
      await library.unshare(id);
      setShareUrl(null);
      setTrip((t) => ({ ...t, shareToken: null }));
    } catch { /* no-op */ }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the URL is visible anyway */ }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 size={26} className="spin" color="var(--accent-primary)" aria-hidden="true" />
      </div>
    );
  }
  if (error || !trip) {
    return (
      <ErrorState
        title={shared ? 'This link is no longer valid' : 'Trip not found'}
        message={error}
      />
    );
  }

  // A shared trip has no coordinates on the itinerary itself, but the first
  // hotel in the plan is a good enough anchor for "what's nearby".
  const anchor = trip.travelData?.hotels?.find((h) => h.latitude && h.longitude);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <Link to={shared ? '/' : '/library'} className="btn-ghost">
          <ArrowLeft size={15} aria-hidden="true" /> {shared ? 'Explore Velora' : 'Back to library'}
        </Link>

        {shared ? (
          <span className="chip" style={{ cursor: 'default' }}>
            <Eye size={12} aria-hidden="true" /> Shared itinerary · read only
          </span>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" aria-pressed={trip.isSaved} onClick={toggleSave}>
              <Bookmark size={14} fill={trip.isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
              {trip.isSaved ? 'Saved' : 'Save'}
            </button>
            {shareUrl ? (
              <button className="btn-secondary" onClick={unshare}>
                <Share2 size={14} aria-hidden="true" /> Stop sharing
              </button>
            ) : (
              <button className="btn-secondary" onClick={share}>
                <Share2 size={14} aria-hidden="true" /> Share
              </button>
            )}
          </div>
        )}
      </div>

      {shareUrl && !shared && (
        <div
          className="glass-panel"
          style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Anyone with this link can view:
          </span>
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.target.select()}
            className="input-field"
            style={{ flex: 1, minWidth: 180, fontSize: '0.8rem' }}
            aria-label="Share link"
          />
          <button className="btn-icon" onClick={copy} aria-label="Copy share link">
            {copied ? <Check size={14} color="var(--success)" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          </button>
          {trip.viewCount > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {trip.viewCount} view{trip.viewCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}

      <ItineraryDisplay itinerary={trip} onBookItem={shared ? undefined : (t, i, ti, a) => setBookingItem({ serviceType: t, id: i, title: ti, amount: a })} />

      {/* Owner-only planning tools */}
      {!shared && (
        <div style={{ display: 'grid', gap: '1.25rem', marginTop: '1.5rem' }}>
          <TravelChecklist itineraryId={trip._id} />
          {anchor && (
            <NearbyPanel
              lat={anchor.latitude}
              lng={anchor.longitude}
              title={`Around your stay in ${trip.destination}`}
            />
          )}
        </div>
      )}

      {bookingItem && (
        <BookingModal
          bookingItem={bookingItem}
          itineraryId={trip._id}
          onClose={() => setBookingItem(null)}
        />
      )}
    </div>
  );
}
