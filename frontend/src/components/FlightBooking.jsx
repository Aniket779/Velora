import React from 'react';
import { Plane, Clock, ShieldCheck, ArrowRight } from 'lucide-react';

export default function FlightBooking({ flights, onBookItem }) {
  return (
    <div className="cards-grid">
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
        Available Flights ({flights.length})
      </h3>
      {flights.map((flight) => (
        <div key={flight.id} className="listing-card glass-panel glass-panel-hover">
          {flight.tag && <div className="card-badge">{flight.tag}</div>}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '180px' }}>
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '12px', 
              background: 'rgba(99, 102, 241, 0.1)', display: 'flex', 
              alignItems: 'center', justifyCenter: 'center', fontSize: '1.5rem',
              justifyContent: 'center'
            }}>
              {flight.logo || '✈️'}
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', color: 'white' }}>{flight.airline}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{flight.code}</p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1.5rem', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{flight.departure}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{flight.from}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> {flight.duration}
              </span>
              <div style={{ width: '80px', height: '2px', background: 'var(--accent-gradient)', position: 'relative' }}>
                <Plane size={14} style={{ position: 'absolute', top: '-6px', left: '33px', color: '#a5b4fc' }} />
              </div>
              <span style={{ fontSize: '0.7rem', color: '#a855f7' }}>{flight.stops}</span>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{flight.arrival}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{flight.to}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', minWidth: '150px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>
              ₹{flight.price.toLocaleString()}
            </span>
            <button 
              className="btn-primary" 
              onClick={() => onBookItem('Flight', flight.id, `${flight.airline} ${flight.code} (${flight.from} → ${flight.to})`, flight.price)}
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
            >
              Book Flight <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
