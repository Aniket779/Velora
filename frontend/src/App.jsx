import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Plane, Compass, Loader2, Filter, User, Globe, Sparkles } from 'lucide-react';
import { io } from 'socket.io-client';
import axios from 'axios';

import ServiceTabs from './components/ServiceTabs';
import SearchWidget from './components/SearchWidget';
import FlightBooking from './components/FlightBooking';
import HotelBooking from './components/HotelBooking';
import CabBooking from './components/CabBooking';
import BookingModal from './components/BookingModal';
import FloatingAIAssistant from './components/FloatingAIAssistant';
import ItineraryDisplay from './components/ItineraryDisplay';

function MainPortal() {
  const [activeTab, setActiveTab] = useState('flights');
  
  // Data lists
  const [flights, setFlights] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [cabs, setCabs] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // AI Itinerary state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatedItinerary, setGeneratedItinerary] = useState(null);

  // Active Booking Modal
  const [bookingItem, setBookingItem] = useState(null);

  // Fetch initial services on mount
  useEffect(() => {
    fetchServicesData('flights');
  }, []);

  const fetchServicesData = async (tab, params = {}) => {
    setLoadingServices(true);
    try {
      if (tab === 'flights') {
        const res = await axios.get('http://localhost:5000/api/v1/services/flights', { params });
        setFlights(res.data.data || []);
      } else if (tab === 'hotels') {
        const res = await axios.get('http://localhost:5000/api/v1/services/hotels', { params });
        setHotels(res.data.data || []);
      } else if (tab === 'cabs') {
        const res = await axios.get('http://localhost:5000/api/v1/services/cabs', { params });
        setCabs(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load services data', err);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab !== 'ai-holidays') {
      fetchServicesData(newTab);
    }
  };

  const handleSearchSubmit = (tab, searchParams) => {
    fetchServicesData(tab, searchParams);
  };

  const handleStartAIGeneration = async (aiFormData) => {
    setIsGeneratingAI(true);
    setGeneratedItinerary(null);
    try {
      await axios.post('http://localhost:5000/api/v1/trips/generate', aiFormData);
    } catch (err) {
      console.error('Failed AI generation request', err);
      // Fallback local simulation if backend queue worker is off
      setTimeout(() => {
        setGeneratedItinerary({
          destination: aiFormData.destination || 'Kyoto, Japan',
          duration: `${aiFormData.days || 3} Days`,
          budget: aiFormData.budget || 'Moderate',
          schedule: [
            { day: 1, title: 'Historic Arrival & Temples', highlights: ['Fushimi Inari Shrine', 'Gion District Walk', 'Kyoto Tower'] },
            { day: 2, title: 'Arashiyama Bamboo & Zen Gardens', highlights: ['Bamboo Grove Walk', 'Tenryu-ji Temple', 'Traditional Tea Ceremony'] },
            { day: 3, title: 'Culinary Exploration & Departure', highlights: ['Nishiki Market Tour', 'Kinkaku-ji Golden Pavilion', 'Souvenir Shopping'] },
          ]
        });
        setIsGeneratingAI(false);
      }, 3000);
    }
  };

  // Socket setup for BullMQ completion
  useEffect(() => {
    const socket = io('http://localhost:5000', {
      auth: { userId: 'user_123' }
    });

    socket.on('itinerary_generated', (data) => {
      setGeneratedItinerary(data.itinerary);
      setIsGeneratingAI(false);
    });

    return () => socket.disconnect();
  }, []);

  const handleOpenBookingModal = (serviceType, id, title, amount) => {
    setBookingItem({ serviceType, id, title, amount });
  };

  return (
    <div>
      {/* MMT Style Top Category Tabs Bar */}
      <ServiceTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Dynamic Search Box Widget */}
      <div style={{ marginTop: '2.5rem' }}>
        <SearchWidget 
          activeTab={activeTab} 
          onSearch={handleSearchSubmit} 
          onGenerateAI={handleStartAIGeneration}
        />
      </div>

      {/* Main Content & Filter Sidebar Grid */}
      <div className="main-layout">
        {/* Left Filter Sidebar */}
        <aside className="filters-sidebar glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', borderBottom: '1px solid var(--border-glass-light)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} color="var(--accent-primary)" /> Filter Results
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#a5b4fc', cursor: 'pointer' }}>Reset All</span>
          </div>

          <div className="filter-group">
            <div className="filter-title">Price Range</div>
            <label className="filter-checkbox"><input type="checkbox" defaultChecked /> Under ₹5,000</label>
            <label className="filter-checkbox"><input type="checkbox" defaultChecked /> ₹5,000 - ₹15,000</label>
            <label className="filter-checkbox"><input type="checkbox" defaultChecked /> Luxury (₹15,000+)</label>
          </div>

          <div className="filter-group">
            <div className="filter-title">Customer Ratings</div>
            <label className="filter-checkbox"><input type="checkbox" defaultChecked /> 4.5+ Top Rated</label>
            <label className="filter-checkbox"><input type="checkbox" defaultChecked /> 4.0+ Very Good</label>
          </div>

          {activeTab === 'flights' && (
            <div className="filter-group">
              <div className="filter-title">Stops</div>
              <label className="filter-checkbox"><input type="checkbox" defaultChecked /> Non-Stop Only</label>
              <label className="filter-checkbox"><input type="checkbox" /> 1 Stop</label>
            </div>
          )}

          {activeTab === 'hotels' && (
            <div className="filter-group">
              <div className="filter-title">Property Category</div>
              <label className="filter-checkbox"><input type="checkbox" defaultChecked /> 5 Star Resorts</label>
              <label className="filter-checkbox"><input type="checkbox" defaultChecked /> 4 Star Luxury</label>
              <label className="filter-checkbox"><input type="checkbox" /> Heritage Villas</label>
            </div>
          )}
        </aside>

        {/* Right Listings Section */}
        <main>
          {loadingServices ? (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <Loader2 size={36} color="var(--accent-primary)" className="spin" />
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Searching best live options...</p>
            </div>
          ) : (
            <>
              {activeTab === 'flights' && (
                <FlightBooking flights={flights} onBookItem={handleOpenBookingModal} />
              )}

              {activeTab === 'hotels' && (
                <HotelBooking hotels={hotels} onBookItem={handleOpenBookingModal} />
              )}

              {activeTab === 'cabs' && (
                <CabBooking cabs={cabs} onBookItem={handleOpenBookingModal} />
              )}

              {activeTab === 'ai-holidays' && (
                <div>
                  {isGeneratingAI && (
                    <div style={{ textAlign: 'center', padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <Loader2 size={48} color="var(--accent-primary)" className="spin" />
                      <h2 className="text-gradient">Velora AI is crafting your holiday package...</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>Analyzing flight routes, hotel stays, and local spots...</p>
                    </div>
                  )}

                  {!isGeneratingAI && generatedItinerary && (
                    <div>
                      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyBetween: 'space-between', alignItems: 'center' }}>
                        <button className="btn-primary" onClick={() => setGeneratedItinerary(null)}>
                          Plan Another Holiday
                        </button>
                      </div>
                      <ItineraryDisplay itinerary={generatedItinerary} />
                    </div>
                  )}

                  {!isGeneratingAI && !generatedItinerary && (
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                      <Sparkles size={42} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
                      <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'white' }}>Custom AI Holiday Planner</h3>
                      <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                        Use the search form above to generate a complete personalized holiday package with day-by-day itineraries!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating AI Bot Assistant ("Customise my trip") */}
      <FloatingAIAssistant onQuickSelectAI={() => handleTabChange('ai-holidays')} />

      {/* Booking Checkout Modal */}
      {bookingItem && (
        <BookingModal bookingItem={bookingItem} onClose={() => setBookingItem(null)} />
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        {/* Top Header Navigation */}
        <header className="header">
          <Link to="/" className="brand-logo">
            <div style={{ 
              width: '36px', height: '36px', borderRadius: '10px', 
              background: 'var(--accent-gradient)', display: 'flex', 
              alignItems: 'center', justifyContent: 'center' 
            }}>
              <Plane size={20} color="white" />
            </div>
            <span className="brand-name">Velora</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.875rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Globe size={16} /> INR ₹
            </span>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              background: 'rgba(255,255,255,0.06)', padding: '0.4rem 0.9rem', 
              borderRadius: '999px', border: '1px solid var(--border-glass)' 
            }}>
              <User size={16} color="var(--accent-primary)" />
              <span style={{ fontWeight: 500, color: 'white' }}>My Account</span>
            </div>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<MainPortal />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
