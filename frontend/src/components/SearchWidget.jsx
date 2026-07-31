import React, { useState } from 'react';
import { MapPin, CalendarDays, Users, Search, Sparkles, Car, Wallet, Heart, Mountain, Gauge, Utensils } from 'lucide-react';
import {
  BUDGET_TIERS, TRAVELLER_TYPES, ADVENTURE_LEVELS, PACE_OPTIONS,
  INTERESTS, FOOD_PREFERENCES, MONTHS,
} from '../constants/travelProfile';

const FAMOUS_CITIES = [
  // India
  "Delhi, India", "Mumbai, India", "Goa, India", "Jaipur, India", "Udaipur, India",
  "Agra, India", "Manali, India", "Shimla, India", "Kochi, India", "Ooty, India",
  "Varanasi, India", "Amritsar, India", "Srinagar, India", "Leh, India", "Darjeeling, India",
  "Mysore, India", "Hampi, India", "Pondicherry, India", "Rishikesh, India", "Jaisalmer, India",
  // Global
  "New York, USA", "London, UK", "Paris, France", "Tokyo, Japan", "Dubai, UAE",
  "Singapore, Singapore", "Sydney, Australia", "Rome, Italy", "Bangkok, Thailand", "Bali, Indonesia",
  "Istanbul, Turkey", "Los Angeles, USA", "Barcelona, Spain", "Amsterdam, Netherlands", "Seoul, South Korea",
  // Airports / Generic cab points
  "Delhi Airport (DEL)", "Mumbai Airport (BOM)", "Goa Airport (GOI)", "Downtown Hotel", "Railway Station"
];

export default function SearchWidget({ activeTab, onSearch, onGenerateAI, generating = false }) {
  // Flight search form state
  const [flightSearch, setFlightSearch] = useState({ from: 'Delhi, India', to: 'Mumbai, India', date: '2026-08-01', passengers: '1 Adult, Economy' });
  
  // Hotel search form state
  const [hotelSearch, setHotelSearch] = useState({ city: 'Goa, India', checkIn: '2026-08-05', checkOut: '2026-08-10', guests: '2 Guests, 1 Room' });
  
  // Cab search form state
  const [cabSearch, setCabSearch] = useState({ pickup: 'Delhi Airport (DEL)', drop: 'Downtown Hotel', date: '2026-08-01', type: 'Outstation' });

  // AI Itinerary state — now a full traveller profile rather than four loose fields.
  // Every dimension here is something the generated plan actually adapts to.
  const [aiForm, setAiForm] = useState({
    destination: 'Goa, India',
    origin: 'Delhi, India',
    days: 3,
    budget: 'moderate',
    travellerType: 'couple',
    groupSize: 2,
    adventureLevel: 'moderate',
    pace: 'balanced',
    interests: ['culture', 'food'],
    foodPreferences: ['no-restrictions'],
    travelMonth: '',
    notes: '',
  });

  const toggleInArray = (key, value, { exclusive } = {}) => {
    setAiForm((prev) => {
      const current = prev[key] || [];
      // "No restrictions" is mutually exclusive with every other dietary choice.
      if (exclusive && value === exclusive) return { ...prev, [key]: [exclusive] };
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current.filter((v) => v !== exclusive), value];
      return { ...prev, [key]: next.length ? next : (exclusive ? [exclusive] : []) };
    });
  };

  const pillStyle = (selected) => ({
    padding: '0.4rem 0.85rem',
    borderRadius: 'var(--radius-full)',
    border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
    background: selected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
    color: selected ? '#c7d2fe' : 'var(--text-secondary)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    textTransform: 'capitalize',
    transition: 'all 0.2s ease',
  });

  const segmentStyle = (selected) => ({
    flex: 1,
    minWidth: '110px',
    padding: '0.6rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
    background: selected ? 'rgba(99,102,241,0.18)' : 'transparent',
    color: selected ? 'white' : 'var(--text-secondary)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  });

  const handleFlightSubmit = (e) => {
    e.preventDefault();
    onSearch('flights', flightSearch);
  };

  const handleHotelSubmit = (e) => {
    e.preventDefault();
    onSearch('hotels', hotelSearch);
  };

  const handleCabSubmit = (e) => {
    e.preventDefault();
    onSearch('cabs', cabSearch);
  };

  const handleAiSubmit = (e) => {
    e.preventDefault();
    onGenerateAI(aiForm);
  };

  return (
    <div className="search-widget-panel glass-panel">
      {activeTab === 'flights' && (
        <form onSubmit={handleFlightSubmit}>
          <div className="search-inputs-grid">
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> From</label>
              <select 
                className="input-field" 
                value={flightSearch.from} 
                onChange={(e) => setFlightSearch({ ...flightSearch, from: e.target.value })}
              >
                {FAMOUS_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> To</label>
              <select 
                className="input-field" 
                value={flightSearch.to} 
                onChange={(e) => setFlightSearch({ ...flightSearch, to: e.target.value })}
              >
                {FAMOUS_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="input-box">
              <label className="input-label"><CalendarDays size={14} /> Departure</label>
              <input 
                type="date" 
                className="input-field" 
                value={flightSearch.date} 
                onChange={(e) => setFlightSearch({ ...flightSearch, date: e.target.value })}
              />
            </div>
            <div className="input-box">
              <label className="input-label"><Users size={14} /> Travellers & Class</label>
              <input 
                type="text" 
                className="input-field" 
                value={flightSearch.passengers} 
                onChange={(e) => setFlightSearch({ ...flightSearch, passengers: e.target.value })}
              />
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button type="submit" className="btn-primary">
              <Search size={18} aria-hidden="true" /> Search Flights
            </button>
          </div>
        </form>
      )}

      {activeTab === 'hotels' && (
        <form onSubmit={handleHotelSubmit}>
          <div className="search-inputs-grid">
            <div className="input-box" style={{ gridColumn: 'span 2' }}>
              <label className="input-label"><MapPin size={14} /> Destination</label>
              <select 
                className="input-field" 
                value={hotelSearch.city} 
                onChange={(e) => setHotelSearch({ ...hotelSearch, city: e.target.value })}
              >
                {FAMOUS_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="input-box">
              <label className="input-label"><CalendarDays size={14} /> Check-in</label>
              <input 
                type="date" 
                className="input-field" 
                value={hotelSearch.checkIn} 
                onChange={(e) => setHotelSearch({ ...hotelSearch, checkIn: e.target.value })}
              />
            </div>
            <div className="input-box">
              <label className="input-label"><CalendarDays size={14} /> Check-out</label>
              <input 
                type="date" 
                className="input-field" 
                value={hotelSearch.checkOut} 
                onChange={(e) => setHotelSearch({ ...hotelSearch, checkOut: e.target.value })}
              />
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button type="submit" className="btn-primary">
              <Search size={18} aria-hidden="true" /> Search Hotels
            </button>
          </div>
        </form>
      )}

      {activeTab === 'cabs' && (
        <form onSubmit={handleCabSubmit}>
          <div className="search-inputs-grid">
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> Pickup Location</label>
              <select 
                className="input-field" 
                value={cabSearch.pickup} 
                onChange={(e) => setCabSearch({ ...cabSearch, pickup: e.target.value })}
              >
                {FAMOUS_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> Dropoff Location</label>
              <select 
                className="input-field" 
                value={cabSearch.drop} 
                onChange={(e) => setCabSearch({ ...cabSearch, drop: e.target.value })}
              >
                {FAMOUS_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="input-box">
              <label className="input-label"><CalendarDays size={14} /> Pickup Date & Time</label>
              <input 
                type="text" 
                className="input-field" 
                value={cabSearch.date} 
                onChange={(e) => setCabSearch({ ...cabSearch, date: e.target.value })}
                placeholder="e.g. 2026-08-01 10:00 AM"
              />
            </div>
            <div className="input-box">
              <label className="input-label"><Car size={14} /> Trip Type</label>
              <select 
                className="input-field"
                value={cabSearch.type}
                onChange={(e) => setCabSearch({ ...cabSearch, type: e.target.value })}
              >
                <option value="Outstation">Outstation One-Way</option>
                <option value="Airport">Airport Transfer</option>
                <option value="Hourly">Hourly Rental</option>
              </select>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button type="submit" className="btn-primary">
              <Search size={18} aria-hidden="true" /> Search Cabs
            </button>
          </div>
        </form>
      )}

      {activeTab === 'ai-holidays' && (
        <form onSubmit={handleAiSubmit}>
          <div className="search-inputs-grid">
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> Source City</label>
              <select 
                className="input-field" 
                value={aiForm.origin} 
                onChange={(e) => setAiForm({ ...aiForm, origin: e.target.value })}
              >
                {FAMOUS_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> Destination</label>
              <select 
                className="input-field" 
                value={aiForm.destination} 
                onChange={(e) => setAiForm({ ...aiForm, destination: e.target.value })}
              >
                {FAMOUS_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="input-box">
              <label className="input-label"><CalendarDays size={14} /> Trip Duration (Days)</label>
              <input 
                type="number" 
                min="1" max="14"
                className="input-field" 
                value={aiForm.days} 
                onChange={(e) => setAiForm({ ...aiForm, days: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="input-box">
              <label className="input-label"><Wallet size={14} /> Budget Tier</label>
              <select
                className="input-field"
                value={aiForm.budget}
                onChange={(e) => setAiForm({ ...aiForm, budget: e.target.value })}
              >
                {BUDGET_TIERS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label} — {b.hint}</option>
                ))}
              </select>
            </div>
            <div className="input-box">
              <label className="input-label"><CalendarDays size={14} /> Travel Month</label>
              <select
                className="input-field"
                value={aiForm.travelMonth}
                onChange={(e) => setAiForm({ ...aiForm, travelMonth: e.target.value })}
              >
                <option value="">Not sure yet</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Who is travelling — drives safety, pacing and venue suitability */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="input-label" style={{ marginBottom: '0.6rem' }}>
              <Users size={14} /> Who's travelling?
            </label>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {TRAVELLER_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  style={segmentStyle(aiForm.travellerType === t.value)}
                  onClick={() => setAiForm({ ...aiForm, travellerType: t.value })}
                  aria-pressed={aiForm.travellerType === t.value}
                >
                  <div style={{ fontSize: '1.2rem' }}>{t.icon}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.label}</div>
                </button>
              ))}
              {(aiForm.travellerType === 'family' || aiForm.travellerType === 'group') && (
                <div className="input-box" style={{ minWidth: '120px', padding: '0.5rem 0.75rem' }}>
                  <label className="input-label" style={{ fontSize: '0.68rem' }}>How many?</label>
                  <input
                    type="number" min="2" max="30" className="input-field"
                    value={aiForm.groupSize}
                    onChange={(e) => setAiForm({ ...aiForm, groupSize: parseInt(e.target.value) || 2 })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Adventure level and pace */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <label className="input-label" style={{ marginBottom: '0.6rem' }}>
                <Mountain size={14} /> Adventure Level
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {ADVENTURE_LEVELS.map((a) => (
                  <button
                    key={a.value} type="button"
                    style={segmentStyle(aiForm.adventureLevel === a.value)}
                    onClick={() => setAiForm({ ...aiForm, adventureLevel: a.value })}
                    title={a.hint}
                    aria-pressed={aiForm.adventureLevel === a.value}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{a.label}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.75 }}>{a.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '260px' }}>
              <label className="input-label" style={{ marginBottom: '0.6rem' }}>
                <Gauge size={14} /> Trip Pace
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {PACE_OPTIONS.map((p) => (
                  <button
                    key={p.value} type="button"
                    style={segmentStyle(aiForm.pace === p.value)}
                    onClick={() => setAiForm({ ...aiForm, pace: p.value })}
                    aria-pressed={aiForm.pace === p.value}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.label}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.75 }}>{p.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interests — weight attraction selection */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="input-label" style={{ marginBottom: '0.6rem' }}>
              <Heart size={14} /> Interests <span style={{ opacity: 0.6, textTransform: 'none' }}>(pick any)</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {INTERESTS.map((interest) => (
                <button
                  key={interest} type="button"
                  style={pillStyle(aiForm.interests.includes(interest))}
                  onClick={() => toggleInArray('interests', interest)}
                  aria-pressed={aiForm.interests.includes(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          {/* Food preferences — hard constraints, not suggestions */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="input-label" style={{ marginBottom: '0.6rem' }}>
              <Utensils size={14} /> Food Preferences
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {FOOD_PREFERENCES.map((f) => (
                <button
                  key={f.value} type="button"
                  style={pillStyle(aiForm.foodPreferences.includes(f.value))}
                  onClick={() => toggleInArray('foodPreferences', f.value, { exclusive: 'no-restrictions' })}
                  aria-pressed={aiForm.foodPreferences.includes(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="input-box" style={{ marginBottom: '1.5rem' }}>
            <label className="input-label"><Sparkles size={14} /> Anything else?</label>
            <input
              type="text" className="input-field" maxLength={500}
              value={aiForm.notes}
              onChange={(e) => setAiForm({ ...aiForm, notes: e.target.value })}
              placeholder="e.g. celebrating an anniversary, travelling with a toddler, need wheelchair access"
            />
          </div>

          <div style={{ textAlign: 'center' }}>
            <button type="submit" className="btn-primary" disabled={generating}>
              <Sparkles size={18} aria-hidden="true" />
              {generating ? 'Generating…' : 'Generate My Travel Plan'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
