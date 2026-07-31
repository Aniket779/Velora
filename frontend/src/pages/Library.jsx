import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark, History, Heart, Ticket, Share2, Trash2, Check, Copy,
  Calendar, Wallet, Loader2, X, MapPin,
} from 'lucide-react';
import { library } from '../api/client';
import { useLibrary } from '../hooks/useLibrary';
import { useAuth } from '../hooks/useAuth';
import { EmptyState, ErrorState, SkeletonList } from '../components/states';

/**
 * ============================================================================
 * LIBRARY — Saved Trips, Trip History, Favorites, Booking History
 * ============================================================================
 * Four features, one page, four tabs. They're all "things belonging to this
 * user" and share the same shell, empty states and loading behaviour.
 * ============================================================================
 */

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const date = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const TABS = [
  { id: 'saved', label: 'Saved trips', icon: Bookmark },
  { id: 'history', label: 'Trip history', icon: History },
  { id: 'favorites', label: 'Favourites', icon: Heart },
  { id: 'bookings', label: 'Bookings', icon: Ticket },
];

export default function Library() {
  const [tab, setTab] = useState('saved');
  const { overview, refresh } = useLibrary();
  const { isAuthenticated, loading, openAuth } = useAuth();

  // Wait for /me before deciding — otherwise a signed-in user sees "sign in"
  // flash before their trips appear.
  if (loading) return <SkeletonList count={3} />;

  // A guest has no library by definition. Say so, rather than showing four
  // empty tabs that make it look like their saved trips have vanished.
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 620, margin: '4rem auto', textAlign: 'center' }}>
        <EmptyState
          icon={Bookmark}
          title="Your library lives in your account"
          message="Create a free account to save trips, keep favourites and track bookings. Anything you've generated as a guest stays available in this browser."
          action={
            <button type="button" className="btn-primary" onClick={() => openAuth('register')}>
              Create an account
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <header style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginBottom: '0.4rem' }}>
          Your <span className="text-gradient">library</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          {overview.trips} trip{overview.trips === 1 ? '' : 's'} planned ·{' '}
          {overview.favorites} favourite{overview.favorites === 1 ? '' : 's'} ·{' '}
          {overview.bookings} booking{overview.bookings === 1 ? '' : 's'}
        </p>
      </header>

      <div className="service-tabs-container" style={{ marginBottom: '2rem', justifyContent: 'flex-start' }}>
        <div className="service-tabs" role="tablist" aria-label="Library sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`service-tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" tabIndex={-1}>
        {(tab === 'saved' || tab === 'history') && (
          <TripList savedOnly={tab === 'saved'} onChange={refresh} />
        )}
        {tab === 'favorites' && <FavoritesList />}
        {tab === 'bookings' && <BookingsList onChange={refresh} />}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- saved trips + history */

function TripList({ savedOnly, onChange }) {
  const [state, setState] = useState({ loading: true, items: [], error: null });
  const [shareInfo, setShareInfo] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await library.list({ saved: savedOnly, limit: 30 });
      setState({ loading: false, items: data.items, error: null });
    } catch (e) {
      setState({ loading: false, items: [], error: e?.response?.data?.message || 'Could not load your trips.' });
    }
  }, [savedOnly]);

  useEffect(() => { load(); }, [load]);

  const toggleSave = async (trip) => {
    setState((s) => ({
      ...s,
      items: savedOnly
        ? s.items.filter((t) => t._id !== trip._id)
        : s.items.map((t) => (t._id === trip._id ? { ...t, isSaved: !t.isSaved } : t)),
    }));
    try { await library.save(trip._id, !trip.isSaved); onChange?.(); }
    catch { load(); }
  };

  const remove = async (trip) => {
    setState((s) => ({ ...s, items: s.items.filter((t) => t._id !== trip._id) }));
    try { await library.remove(trip._id); onChange?.(); }
    catch { load(); }
  };

  const share = async (trip) => {
    try {
      const res = await library.share(trip._id);
      const url = `${window.location.origin}/shared/${res.shareToken}`;
      setShareInfo({ id: trip._id, url });
      load();
    } catch { /* surfaced by the list state on reload */ }
  };

  if (state.loading) return <SkeletonList count={3} label="Loading trips" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  if (!state.items.length) {
    return (
      <EmptyState
        icon={savedOnly ? Bookmark : History}
        title={savedOnly ? 'No saved trips yet' : 'No trips yet'}
        message={
          savedOnly
            ? 'Star a trip from your history to keep it here.'
            : 'Generate your first itinerary and it will appear here automatically.'
        }
        action={<Link to="/" className="btn-primary">Plan a trip</Link>}
      />
    );
  }

  return (
    <div className="cards-grid">
      {state.items.map((trip, i) => (
        <article
          key={trip._id}
          className="listing-card glass-panel glass-panel-hover fade-in-up"
          style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
        >
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link to={`/trip/${trip._id}`} className="card-title" style={{ textDecoration: 'none' }}>
                {trip.title}
              </Link>
              {trip.isSaved && (
                <span className="verified-pill" style={{ color: 'var(--accent-gold)', background: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.3)' }}>
                  saved
                </span>
              )}
              {trip.shareToken && (
                <span className="verified-pill" style={{ color: '#a5b4fc', background: 'var(--accent-primary-soft)', borderColor: 'rgba(99,102,241,0.3)' }}>
                  <Share2 size={9} aria-hidden="true" /> shared · {trip.viewCount || 0} views
                </span>
              )}
            </div>

            <p className="card-meta">
              <MapPin size={13} aria-hidden="true" /> {trip.origin} → {trip.destination}
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span><Calendar size={11} style={{ verticalAlign: -1 }} aria-hidden="true" /> {trip.dayCount} days · {date(trip.createdAt)}</span>
              {trip.totalEstimatedCostInr > 0 && (
                <span style={{ color: 'var(--success)' }}>
                  <Wallet size={11} style={{ verticalAlign: -1 }} aria-hidden="true" /> {inr(trip.totalEstimatedCostInr)}
                </span>
              )}
              {trip.profile && <span>{trip.profile.travellerType} · {trip.profile.budget}</span>}
            </div>

            {shareInfo?.id === trip._id && (
              <div style={{
                display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem',
                background: 'var(--accent-primary-soft)', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 'var(--radius-xs)', padding: '0.5rem 0.7rem',
              }}>
                <input
                  readOnly
                  value={shareInfo.url}
                  onFocus={(e) => e.target.select()}
                  className="input-field"
                  style={{ fontSize: '0.78rem' }}
                  aria-label="Share link"
                />
                <button
                  className="btn-icon" style={{ width: 30, height: 30 }}
                  onClick={() => navigator.clipboard?.writeText(shareInfo.url)}
                  aria-label="Copy share link"
                >
                  <Copy size={13} aria-hidden="true" />
                </button>
                <button className="btn-icon" style={{ width: 30, height: 30 }} onClick={() => setShareInfo(null)} aria-label="Dismiss">
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <div className="card-aside">
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                className="btn-icon"
                aria-pressed={trip.isSaved}
                aria-label={trip.isSaved ? 'Remove from saved' : 'Save trip'}
                onClick={() => toggleSave(trip)}
              >
                <Bookmark size={15} fill={trip.isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
              <button className="btn-icon" onClick={() => share(trip)} aria-label="Share trip">
                <Share2 size={15} aria-hidden="true" />
              </button>
              <button className="btn-icon" onClick={() => remove(trip)} aria-label="Delete trip">
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
            <Link to={`/trip/${trip._id}`} className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}>
              Open
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- favourites */

function FavoritesList() {
  const [state, setState] = useState({ loading: true, items: [], error: null });
  const [filter, setFilter] = useState('');
  const { toggleFavorite } = useLibrary();

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await library.favorites(filter || undefined);
      setState({ loading: false, items: data.items, error: null });
    } catch (e) {
      setState({ loading: false, items: [], error: e?.response?.data?.message || 'Could not load favourites.' });
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const unfavorite = async (item) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i._id !== item._id) }));
    await toggleFavorite(item.refType, item.refId);
  };

  if (state.loading) return <SkeletonList count={3} label="Loading favourites" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  const TYPES = ['', 'hotel', 'restaurant', 'place', 'destination'];

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {TYPES.map((t) => (
          <button key={t || 'all'} className="chip" aria-pressed={filter === t} onClick={() => setFilter(t)}>
            {t ? `${t}s` : 'All'}
          </button>
        ))}
      </div>

      {!state.items.length ? (
        <EmptyState
          icon={Heart}
          title="No favourites yet"
          message="Tap the heart on any hotel, restaurant or attraction to keep it here."
          action={<Link to="/" className="btn-primary">Browse</Link>}
        />
      ) : (
        <div className="cards-grid">
          {state.items.map((item, i) => (
            <article
              key={item._id}
              className="listing-card glass-panel glass-panel-hover fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              {item.snapshot?.image && (
                <img className="card-media" src={item.snapshot.image} alt="" loading="lazy" />
              )}
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h4 className="card-title">{item.snapshot?.name}</h4>
                  <span className="tag">{item.refType}</span>
                </div>
                <p className="card-meta">{item.snapshot?.subtitle}</p>
                {item.snapshot?.rating != null && (
                  <span className="rating-pill" style={{ alignSelf: 'flex-start' }}>★ {item.snapshot.rating}</span>
                )}
              </div>
              <div className="card-aside">
                {item.snapshot?.price > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="card-price" style={{ fontSize: '1.15rem' }}>{inr(item.snapshot.price)}</div>
                  </div>
                )}
                <button className="btn-icon" onClick={() => unfavorite(item)} aria-label={`Remove ${item.snapshot?.name} from favourites`}>
                  <Heart size={15} fill="var(--danger)" color="var(--danger)" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- bookings */

function BookingsList({ onChange }) {
  const [state, setState] = useState({ loading: true, items: [], totalSpent: 0, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await library.bookings();
      setState({ loading: false, items: data.items, totalSpent: data.totalSpentInr, error: null });
    } catch (e) {
      setState({ loading: false, items: [], totalSpent: 0, error: e?.response?.data?.message || 'Could not load bookings.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async (b) => {
    setState((s) => ({ ...s, items: s.items.map((x) => (x._id === b._id ? { ...x, status: 'cancelled' } : x)) }));
    try { await library.cancelBooking(b._id); onChange?.(); }
    catch { load(); }
  };

  if (state.loading) return <SkeletonList count={3} label="Loading bookings" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  if (!state.items.length) {
    return (
      <EmptyState
        icon={Ticket}
        title="No bookings yet"
        message="Bookings you make will be listed here with their reference numbers."
        action={<Link to="/" className="btn-primary">Find something to book</Link>}
      />
    );
  }

  return (
    <div>
      <div className="sort-bar">
        <strong style={{ color: 'white' }}>{state.items.length} booking{state.items.length === 1 ? '' : 's'}</strong>
        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
          {inr(state.totalSpent)} total
        </span>
      </div>

      <div className="cards-grid">
        {state.items.map((b, i) => {
          const cancelled = b.status === 'cancelled';
          return (
            <article
              key={b._id}
              className="listing-card glass-panel fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms`, opacity: cancelled ? 0.6 : 1 }}
            >
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h4 className="card-title">{b.title}</h4>
                  <span className="tag">{b.serviceType}</span>
                  <span className="verified-pill" style={cancelled ? {
                    color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'rgba(251,113,133,0.3)',
                  } : undefined}>
                    {cancelled ? 'cancelled' : <><Check size={9} aria-hidden="true" /> confirmed</>}
                  </span>
                </div>
                <p className="card-meta" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '0.03em' }}>
                  {b.referenceId}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Booked {date(b.createdAt)}
                </p>
              </div>

              <div className="card-aside">
                <div style={{ textAlign: 'right' }}>
                  <div className="card-price" style={{ fontSize: '1.25rem', textDecoration: cancelled ? 'line-through' : 'none' }}>
                    {inr(b.amount)}
                  </div>
                </div>
                {!cancelled && (
                  <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }} onClick={() => cancel(b)}>
                    Cancel
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
