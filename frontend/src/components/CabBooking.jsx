import React from 'react';
import { Car, Users, Star, Clock, ArrowRight } from 'lucide-react';

export default function CabBooking({ cabs, onBookItem }) {
  return (
    <div className="cards-grid">
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
        Available Cabs Near You ({cabs.length})
      </h3>
      {cabs.map((cab) => (
        <div key={cab.id} className="listing-card glass-panel glass-panel-hover">
          {cab.badge && <div className="card-badge">{cab.badge}</div>}

          <div style={{ 
            width: '56px', height: '56px', borderRadius: '14px', 
            background: 'rgba(20, 184, 166, 0.12)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', color: '#14b8a6' 
          }}>
            <Car size={28} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <h4 style={{ fontSize: '1.1rem', color: 'white' }}>{cab.name}</h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({cab.model})</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={14} color="#a5b4fc" /> {cab.capacity}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} color="#14b8a6" /> {cab.eta}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fde047' }}>
                <Star size={14} fill="#fde047" /> {cab.driverRating}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', minWidth: '140px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>
              ₹{cab.price.toLocaleString()}
            </span>
            <button 
              className="btn-primary" 
              onClick={() => onBookItem('Cab', cab.id, `${cab.name} (${cab.model})`, cab.price)}
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem', background: 'var(--accent-gradient-teal)' }}
            >
              Book Ride <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
