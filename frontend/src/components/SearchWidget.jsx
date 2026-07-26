import React, { useState } from 'react';
import { MapPin, CalendarDays, Users, Search, Sparkles, Car, Wallet, Heart } from 'lucide-react';

export default function SearchWidget({ activeTab, onSearch, onGenerateAI }) {
  // Flight search form state
  const [flightSearch, setFlightSearch] = useState({ from: 'DEL', to: 'BOM', date: '2026-08-01', passengers: '1 Adult, Economy' });
  
  // Hotel search form state
  const [hotelSearch, setHotelSearch] = useState({ city: 'Kyoto', checkIn: '2026-08-05', checkOut: '2026-08-10', guests: '2 Guests, 1 Room' });
  
  // Cab search form state
  const [cabSearch, setCabSearch] = useState({ pickup: 'Airport Terminal 3', drop: 'Downtown Hotel', date: '2026-08-01', type: 'Outstation' });

  // AI Itinerary state
  const [aiForm, setAiForm] = useState({ destination: 'Kyoto, Japan', days: 3, budget: 'moderate', preferences: 'Foodie, Culture' });

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
              <input 
                type="text" 
                className="input-field" 
                value={flightSearch.from} 
                onChange={(e) => setFlightSearch({ ...flightSearch, from: e.target.value })}
                placeholder="City or Airport (e.g. DEL)"
              />
            </div>
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> To</label>
              <input 
                type="text" 
                className="input-field" 
                value={flightSearch.to} 
                onChange={(e) => setFlightSearch({ ...flightSearch, to: e.target.value })}
                placeholder="City or Airport (e.g. BOM)"
              />
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
              <Search size={18} /> Search Flights
            </button>
          </div>
        </form>
      )}

      {activeTab === 'hotels' && (
        <form onSubmit={handleHotelSubmit}>
          <div className="search-inputs-grid">
            <div className="input-box" style={{ gridColumn: 'span 2' }}>
              <label className="input-label"><MapPin size={14} /> Destination / Hotel Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={hotelSearch.city} 
                onChange={(e) => setHotelSearch({ ...hotelSearch, city: e.target.value })}
                placeholder="City or Hotel Name (e.g. Kyoto)"
              />
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
              <Search size={18} /> Search Hotels
            </button>
          </div>
        </form>
      )}

      {activeTab === 'cabs' && (
        <form onSubmit={handleCabSubmit}>
          <div className="search-inputs-grid">
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> Pickup Location</label>
              <input 
                type="text" 
                className="input-field" 
                value={cabSearch.pickup} 
                onChange={(e) => setCabSearch({ ...cabSearch, pickup: e.target.value })}
              />
            </div>
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> Dropoff Location</label>
              <input 
                type="text" 
                className="input-field" 
                value={cabSearch.drop} 
                onChange={(e) => setCabSearch({ ...cabSearch, drop: e.target.value })}
              />
            </div>
            <div className="input-box">
              <label className="input-label"><CalendarDays size={14} /> Pickup Date & Time</label>
              <input 
                type="text" 
                className="input-field" 
                value={cabSearch.date} 
                onChange={(e) => setCabSearch({ ...cabSearch, date: e.target.value })}
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
              <Search size={18} /> Search Cabs
            </button>
          </div>
        </form>
      )}

      {activeTab === 'ai-holidays' && (
        <form onSubmit={handleAiSubmit}>
          <div className="search-inputs-grid">
            <div className="input-box">
              <label className="input-label"><MapPin size={14} /> Destination</label>
              <input 
                type="text" 
                className="input-field" 
                value={aiForm.destination} 
                onChange={(e) => setAiForm({ ...aiForm, destination: e.target.value })}
                placeholder="e.g. Kyoto, Japan"
              />
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
              <label className="input-label"><Wallet size={14} /> Budget Preference</label>
              <select 
                className="input-field"
                value={aiForm.budget}
                onChange={(e) => setAiForm({ ...aiForm, budget: e.target.value })}
              >
                <option value="budget">Budget-Friendly</option>
                <option value="moderate">Moderate</option>
                <option value="luxury">Luxury</option>
              </select>
            </div>
            <div className="input-box">
              <label className="input-label"><Heart size={14} /> Vibe / Focus</label>
              <input 
                type="text" 
                className="input-field" 
                value={aiForm.preferences} 
                onChange={(e) => setAiForm({ ...aiForm, preferences: e.target.value })}
                placeholder="e.g. Foodie, Relaxed"
              />
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button type="submit" className="btn-primary">
              <Sparkles size={18} /> Generate AI Itinerary
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
