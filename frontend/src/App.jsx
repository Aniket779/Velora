import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Plane, Compass, Calendar, MapPin } from 'lucide-react';

function Home() {
  return (
    <div className="hero-section">
      <div className="glass-panel" style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        ✨ Powered by AI Route Optimization
      </div>
      <h1 className="hero-title">
        Plan your next adventure with <br />
        <span className="text-gradient">Velora Intelligence</span>
      </h1>
      <p className="hero-subtitle">
        Collaborative itineraries, dynamic route optimization, and personalized travel recommendations in one place.
      </p>
      <button className="btn-primary" style={{ marginTop: '1rem', fontSize: '1.125rem' }}>
        <Compass size={20} /> Start Planning
      </button>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
      <h2>Your Dashboard</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Your upcoming trips will appear here.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="header">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'white' }}>
            <Plane size={28} color="var(--accent-primary)" />
            <span style={{ fontFamily: 'Outfit', fontSize: '1.5rem', fontWeight: '700', letterSpacing: '-0.02em' }}>
              Velora
            </span>
          </Link>
          
          <nav className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/dashboard">Dashboard</Link>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
