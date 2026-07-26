import React from 'react';
import { MapPin, Utensils, BedDouble, Navigation } from 'lucide-react';

export default function ItineraryDisplay({ itinerary }) {
  if (!itinerary || !itinerary.days) return null;

  const getIcon = (type) => {
    switch(type) {
      case 'hotel': return <BedDouble size={18} color="var(--accent-secondary)" />;
      case 'food': return <Utensils size={18} color="#f59e0b" />;
      case 'activity': return <MapPin size={18} color="var(--accent-primary)" />;
      case 'transit': return <Navigation size={18} color="var(--text-secondary)" />;
      default: return <MapPin size={18} />;
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '2rem' }}>
        <span className="text-gradient">{itinerary.trip_title}</span>
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {itinerary.days.map((day) => (
          <div key={day.day_number} className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Day {day.day_number}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {day.activities.map((activity, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ minWidth: '60px', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, paddingTop: '4px' }}>
                    {activity.start_time}
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '12px', flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-glass)' }}>
                    <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                      {getIcon(activity.type)}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>{activity.title}</h4>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{activity.location_name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
