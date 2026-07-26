import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, MapPin, CalendarDays, Wallet, Heart } from 'lucide-react';

export default function AIGeneratorForm({ onGenerationStarted }) {
  const [formData, setFormData] = useState({
    destination: '',
    days: 3,
    budget: 'moderate',
    preferences: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Hit the backend AI endpoint
      await axios.post('http://localhost:5000/api/v1/trips/generate', formData);
      onGenerationStarted(); // Tell the parent App to show loading state
    } catch (error) {
      console.error('Error starting generation', error);
      alert('Failed to start generation. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Sparkles color="var(--accent-primary)" />
        <h2>AI Itinerary Builder</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <MapPin size={14} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} /> Destination
            </label>
            <input 
              required
              type="text" 
              placeholder="e.g. Kyoto, Japan"
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <CalendarDays size={14} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} /> Days
            </label>
            <input 
              required
              type="number" 
              min="1" max="14"
              value={formData.days}
              onChange={(e) => setFormData({...formData, days: parseInt(e.target.value)})}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <Wallet size={14} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} /> Budget
            </label>
            <select 
              value={formData.budget}
              onChange={(e) => setFormData({...formData, budget: e.target.value})}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            >
              <option value="budget">Budget-Friendly</option>
              <option value="moderate">Moderate</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <Heart size={14} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} /> Vibe / Focus
            </label>
            <input 
              type="text" 
              placeholder="e.g. Foodie, Museums, Relaxed pacing"
              value={formData.preferences}
              onChange={(e) => setFormData({...formData, preferences: e.target.value})}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem', justifyContent: 'center' }}>
          {loading ? 'Submitting...' : 'Generate Magic'}
        </button>
      </form>
    </div>
  );
}
