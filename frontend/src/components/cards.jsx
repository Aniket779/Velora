import React from 'react';
import {
  Star, MapPin, Clock, ArrowRight, Plane, Users, Car,
  CheckCircle2, Utensils, Heart,
} from 'lucide-react';
import { useLibrary } from '../hooks/useLibrary';

/**
 * ============================================================================
 * SHARED LISTING CARDS
 * ============================================================================
 * One definition per entity type, used by BOTH the browse tabs and the AI
 * itinerary view.
 *
 * WHY THIS FILE EXISTS
 * Hotel and flight cards were previously written twice — once in
 * HotelBooking/FlightBooking and again inside ItineraryDisplay — with
 * different markup and different field names. That's why the code was full of
 * `hotel.hotelName || hotel.name` fallbacks: the two API shapes disagreed and
 * each copy compensated differently. Normalising once, here, removes both the
 * duplication and the fallbacks.
 * ============================================================================
 */

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Handles both API shapes so the rest of the UI doesn't have to. */
const normaliseHotel = (h) => ({
  id: h._id || h.id,
  name: h.hotelName || h.name,
  image: (h.images && h.images[0]) || h.image,
  location: h.address || [h.city, h.state].filter(Boolean).join(', ') || h.location,
  rating: h.rating,
  reviews: h.totalReviews ?? h.reviewsCount,
  price: h.pricePerNight ?? h.price,
  amenities: h.amenities || [],
  category: h.category,
});

const normaliseFlight = (f) => ({
  id: f._id || f.id,
  airline: f.airline,
  code: f.flightNumber || f.code,
  from: f.from,
  to: f.to,
  fromAirport: f.fromAirport,
  toAirport: f.toAirport,
  departure: f.departureTime || f.departure,
  arrival: f.arrivalTime || f.arrival,
  duration: f.duration,
  price: f.price,
  stops: typeof f.stops === 'number' ? f.stops : (f.stops === 'Non-stop' ? 0 : 0),
  tag: f.tag,
});

/**
 * Favourite toggle. Reads shared state from LibraryProvider so the same item
 * shows the same heart everywhere it appears — search results, itinerary,
 * nearby panel — and toggling in one place updates all of them.
 */
function FavoriteButton({ refType, refId, name }) {
  const { isFavorite, toggleFavorite } = useLibrary();
  if (!refId) return null;

  const active = isFavorite(refType, refId);

  return (
    <button
      className="btn-icon"
      style={{ width: 32, height: 32, color: active ? 'var(--danger)' : undefined }}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(refType, String(refId)); }}
    >
      <Heart size={15} fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}

const Rating = ({ value, reviews }) =>
  value == null ? null : (
    <span className="rating-pill">
      <Star size={11} fill="currentColor" aria-hidden="true" />
      {value}
      {reviews ? <span style={{ opacity: 0.75, fontWeight: 500 }}>({reviews})</span> : null}
    </span>
  );

/** Fallback image if a record has none or the URL 404s. */
const FALLBACK = {
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
  place: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
};

const Media = ({ src, alt, kind }) => (
  <img
    className="card-media"
    src={src || FALLBACK[kind]}
    alt=""                       /* decorative: the card title carries the name */
    loading="lazy"
    onError={(e) => { e.currentTarget.src = FALLBACK[kind]; }}
  />
);

/* ========================================================================== */

export function HotelCard({ hotel, onBook, index = 0 }) {
  const h = normaliseHotel(hotel);

  return (
    <article
      className="listing-card glass-panel glass-panel-hover fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <Media src={h.image} kind="hotel" />

      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h4 className="card-title">{h.name}</h4>
          <Rating value={h.rating} reviews={h.reviews} />
        </div>

        <p className="card-meta">
          <MapPin size={13} aria-hidden="true" /> {h.location}
          {h.category && <span style={{ color: 'var(--accent-secondary)' }}>· {h.category}</span>}
        </p>

        {h.amenities.length > 0 && (
          <div className="tag-row" style={{ marginTop: 'auto', paddingTop: '0.35rem' }}>
            {h.amenities.slice(0, 4).map((a) => (
              <span key={a} className="tag">
                <CheckCircle2 size={9} style={{ verticalAlign: -1, marginRight: 3, color: 'var(--accent-teal)' }} aria-hidden="true" />
                {a}
              </span>
            ))}
            {h.amenities.length > 4 && <span className="tag">+{h.amenities.length - 4} more</span>}
          </div>
        )}
      </div>

      <div className="card-aside">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FavoriteButton refType="hotel" refId={h.id} name={h.name} />
          <div style={{ textAlign: 'right' }}>
            <div className="card-price">{inr(h.price)}</div>
            <div className="card-price-unit">per night + taxes</div>
          </div>
        </div>
        {onBook && (
          <button
            className="btn-primary"
            style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem' }}
            onClick={() => onBook('Hotel', h.id, h.name, h.price)}
          >
            Book room <ArrowRight size={14} aria-hidden="true" />
            <span className="sr-only"> at {h.name}</span>
          </button>
        )}
      </div>
    </article>
  );
}

/* ========================================================================== */

export function FlightCard({ flight, onBook, index = 0 }) {
  const f = normaliseFlight(flight);

  return (
    <article
      className="listing-card glass-panel glass-panel-hover fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      {f.tag && <div className="card-badge">{f.tag}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '158px' }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'var(--accent-primary-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <Plane size={20} color="var(--accent-primary)" />
        </div>
        <div>
          <h4 className="card-title" style={{ fontSize: '1rem' }}>{f.airline}</h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{f.code}</p>
        </div>
      </div>

      <div className="flight-route">
        <div style={{ textAlign: 'center' }}>
          <div className="flight-time">{f.departure}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {f.fromAirport || f.from}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} aria-hidden="true" /> {f.duration}
          </span>
          <div className="flight-line" aria-hidden="true" />
          <span style={{ fontSize: '0.68rem', color: f.stops === 0 ? 'var(--success)' : 'var(--warning)' }}>
            {f.stops === 0 ? 'Non-stop' : `${f.stops} stop`}
          </span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="flight-time">{f.arrival}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {f.toAirport || f.to}
          </div>
        </div>
      </div>

      <div className="card-aside">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FavoriteButton refType="flight" refId={f.id} name={`${f.airline} ${f.code}`} />
          <div style={{ textAlign: 'right' }}>
            <div className="card-price">{inr(f.price)}</div>
            <div className="card-price-unit">per traveller</div>
          </div>
        </div>
        {onBook && (
          <button
            className="btn-primary"
            style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem' }}
            onClick={() => onBook('Flight', f.id, `${f.airline} ${f.code} (${f.from} → ${f.to})`, f.price)}
          >
            Book flight <ArrowRight size={14} aria-hidden="true" />
            <span className="sr-only"> {f.airline} {f.code}</span>
          </button>
        )}
      </div>
    </article>
  );
}

/* ========================================================================== */

export function RestaurantCard({ restaurant: r, index = 0 }) {
  const cuisines = Array.isArray(r.cuisine) ? r.cuisine : [r.cuisine].filter(Boolean);
  const dishes = r.signatureDishes || [];

  return (
    <article
      className="listing-card glass-panel glass-panel-hover fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <Media src={(r.images && r.images[0]) || r.image} kind="restaurant" />

      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h4 className="card-title">{r.name}</h4>
          <Rating value={r.rating} />
        </div>

        <p className="card-meta">
          <Utensils size={13} aria-hidden="true" /> {cuisines.join(' · ') || 'Multi-cuisine'}
        </p>

        {dishes.length > 0 && (
          <p style={{ fontSize: '0.81rem', color: 'var(--accent-gold)' }}>
            Known for: {dishes.join(', ')}
          </p>
        )}

        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '0.3rem' }}>
          <MapPin size={11} style={{ verticalAlign: -1 }} aria-hidden="true" /> {r.address}
          {r.openingHours && <> · <Clock size={11} style={{ verticalAlign: -1 }} aria-hidden="true" /> {r.openingHours}</>}
        </p>
      </div>

      <div className="card-aside">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FavoriteButton refType="restaurant" refId={r._id || r.id} name={r.name} />
          <div style={{ textAlign: 'right' }}>
            <div className="card-price">{inr(r.priceForTwo)}</div>
            <div className="card-price-unit">for two</div>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ========================================================================== */

export function PlaceCard({ place: p, index = 0 }) {
  return (
    <article
      className="listing-card glass-panel glass-panel-hover fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <Media src={(p.images && p.images[0]) || p.image} kind="place" />

      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h4 className="card-title">{p.name}</h4>
          {p.category && (
            <span className="tag" style={{ color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.3)' }}>
              {p.category}
            </span>
          )}
          <Rating value={p.rating} />
        </div>

        {p.description && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {p.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '0.35rem' }}>
          {p.recommendedVisitTime && (
            <span><Clock size={11} style={{ verticalAlign: -1 }} aria-hidden="true" /> Best: {p.recommendedVisitTime}</span>
          )}
          {p.averageTimeRequired && <span>Duration: {p.averageTimeRequired}</span>}
        </div>
      </div>

      <div className="card-aside">
        <FavoriteButton refType="place" refId={p._id || p.id} name={p.name} />
        <div style={{ textAlign: 'right' }}>
          {p.entryFeeInr > 0 ? (
            <>
              <div className="card-price" style={{ fontSize: '1.2rem' }}>{inr(p.entryFeeInr)}</div>
              <div className="card-price-unit">entry</div>
            </>
          ) : (
            <span className="verified-pill" style={{ fontSize: '0.75rem' }}>Free entry</span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ========================================================================== */

export function CabCard({ cab, onBook, index = 0 }) {
  return (
    <article
      className="listing-card glass-panel glass-panel-hover fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      {cab.badge && <div className="card-badge">{cab.badge}</div>}

      <div
        style={{
          width: 54, height: 54, borderRadius: 14,
          background: 'rgba(20, 184, 166, 0.13)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-teal)', flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <Car size={26} />
      </div>

      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <h4 className="card-title">{cab.name}</h4>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({cab.model})</span>
        </div>
        <div style={{ display: 'flex', gap: '1.15rem', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.83rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={13} color="#a5b4fc" aria-hidden="true" /> {cab.capacity}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={13} color="var(--accent-teal)" aria-hidden="true" /> {cab.eta}
          </span>
          <Rating value={cab.driverRating} />
        </div>
      </div>

      <div className="card-aside">
        <div style={{ textAlign: 'right' }}>
          <div className="card-price">{inr(cab.price)}</div>
          <div className="card-price-unit">estimated fare</div>
        </div>
        {onBook && (
          <button
            className="btn-primary"
            style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem', background: 'var(--accent-gradient-teal)' }}
            onClick={() => onBook('Cab', cab.id, `${cab.name} (${cab.model})`, cab.price)}
          >
            Book ride <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

export { inr, normaliseHotel, normaliseFlight, FavoriteButton };
