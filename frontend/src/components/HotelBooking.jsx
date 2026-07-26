import React from 'react';
import { Star, MapPin, CheckCircle, ArrowRight } from 'lucide-react';

export default function HotelBooking({ hotels, onBookItem }) {
  return (
    <div className="cards-grid">
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
        Top Recommended Hotels & Resorts ({hotels.length})
      </h3>
      {hotels.map((hotel) => (
        <div key={hotel.id} className="listing-card glass-panel glass-panel-hover" style={{ alignItems: 'stretch' }}>
          <img 
            src={hotel.image} 
            alt={hotel.name}
            style={{ 
              width: '180px', height: '130px', borderRadius: '12px', 
              objectFit: 'cover' 
            }} 
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h4 style={{ fontSize: '1.15rem', color: 'white' }}>{hotel.name}</h4>
                <span style={{ 
                  background: 'rgba(234, 179, 8, 0.15)', color: '#fde047', 
                  fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                  display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600
                }}>
                  <Star size={12} fill="#fde047" /> {hotel.rating} ({hotel.reviewsCount})
                </span>
              </div>
              
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.75rem' }}>
                <MapPin size={14} color="var(--accent-primary)" /> {hotel.location} • <span style={{ color: '#a855f7' }}>{hotel.category}</span>
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {hotel.amenities.map((amenity, idx) => (
                <span key={idx} style={{ 
                  fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)',
                  padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-glass-light)',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  <CheckCircle size={10} color="#14b8a6" /> {amenity}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', minWidth: '150px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>
                ₹{hotel.pricePerNight.toLocaleString()}
              </span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>per night + taxes</p>
            </div>

            <button 
              className="btn-primary" 
              onClick={() => onBookItem('Hotel', hotel.id, `${hotel.name} (${hotel.location})`, hotel.pricePerNight)}
              style={{ padding: '0.55rem 1.25rem', fontSize: '0.875rem' }}
            >
              Book Room <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
