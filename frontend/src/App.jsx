import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import {
  Loader2, Globe, Sparkles, Plane, RefreshCw, Wifi, WifiOff, Library as LibraryIcon,
  LogIn, LogOut,
} from 'lucide-react';
import { io } from 'socket.io-client';

import Hero from './components/Hero';
import ServiceTabs from './components/ServiceTabs';
import SearchWidget from './components/SearchWidget';
import BookingModal from './components/BookingModal';
import FloatingAIAssistant from './components/FloatingAIAssistant';
import ItineraryDisplay from './components/ItineraryDisplay';
import { FilterSidebar, SortBar } from './components/FilterSort';
import { HotelCard, FlightCard, CabCard } from './components/cards';
import { ErrorBoundary, EmptyState, ErrorState, SkeletonList } from './components/states';
import { useFilterSort } from './hooks/useFilterSort';

import Library from './pages/Library';
import TripPage from './pages/TripPage';
import DestinationPage from './pages/DestinationPage';
import { Recommendations, RecentlyViewed } from './components/discover';
import { LibraryProvider, useLibrary } from './hooks/useLibrary';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthModal from './components/AuthModal';
import { catalog, trips as tripsApi } from './api/client';

import { SOCKET_URL, AI_GENERATION_TIMEOUT_MS, AI_POLL_INTERVAL_MS } from './config';
import { SOCKET_EVENTS } from './constants/socketEvents';
import { getUserId, getToken } from './utils/identity';

const normalizePlaceName = (v = '') => (v || '').toString().trim().split(',')[0].trim();
const extractApiError = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

const FETCHERS = {
  flights: catalog.flights,
  hotels: catalog.hotels,
  cabs: catalog.cabs,
};

function MainPortal() {
  // Identity changes must re-handshake the socket — see the socket effect below.
  const { user } = useAuth();
  const currentUserId = user?.id || null;

  const [activeTab, setActiveTab] = useState('flights');

  // One record per tab keeps each list's data, loading and error state separate,
  // so switching tabs never shows another tab's error.
  const [data, setData] = useState({ flights: [], hotels: [], cabs: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatedItinerary, setGeneratedItinerary] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [aiProgress, setAiProgress] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);

  const [bookingItem, setBookingItem] = useState(null);

  const activeJobIdRef = useRef(null);
  const timeoutRef = useRef(null);
  const pollRef = useRef(null);
  const lastRequestRef = useRef(null);
  const lastSearchRef = useRef({});

  const items = data[activeTab] || [];
  const fs = useFilterSort(items, activeTab);

  // ---------------------------------------------------------------- fetching

  const fetchServicesData = useCallback(async (tab, params = {}) => {
    const fetcher = FETCHERS[tab];
    if (!fetcher) return;

    lastSearchRef.current[tab] = params;
    setLoading(true);
    setLoadError(null);

    try {
      const results = await fetcher(params);
      setData((prev) => ({ ...prev, [tab]: results || [] }));
    } catch (err) {
      // Distinguishable from an empty result — the old code logged and left an
      // empty list, so "server down" and "no matches" looked identical.
      setLoadError(extractApiError(err, 'Could not reach the server.'));
      setData((prev) => ({ ...prev, [tab]: [] }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServicesData('flights'); }, [fetchServicesData]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setLoadError(null);
    if (tab !== 'ai-holidays' && !data[tab]?.length) fetchServicesData(tab);
  };

  const handleSearchSubmit = (tab, params) => {
    setHasSearched(true);
    fetchServicesData(tab, params);
  };

  const retryLoad = () => fetchServicesData(activeTab, lastSearchRef.current[activeTab] || {});

  // ------------------------------------------------------------- generation

  const clearGenerationTimers = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const settleSuccess = useCallback((jobId, itinerary) => {
    if (activeJobIdRef.current !== jobId) return;   // stale result — discard
    clearGenerationTimers();
    activeJobIdRef.current = null;
    setGeneratedItinerary(itinerary);
    setIsGeneratingAI(false);
    setAiProgress(100);
    setAiError(null);
  }, [clearGenerationTimers]);

  const settleFailure = useCallback((jobId, message) => {
    if (jobId !== null && activeJobIdRef.current !== jobId) return;
    clearGenerationTimers();
    activeJobIdRef.current = null;
    setIsGeneratingAI(false);
    setGeneratedItinerary(null);
    setAiError(message);
  }, [clearGenerationTimers]);

  const pollGenerationStatus = useCallback(async (jobId) => {
    if (activeJobIdRef.current !== jobId) return;
    try {
      const { state, itinerary, error, progress } = await tripsApi.status(jobId);
      if (typeof progress === 'number') setAiProgress(progress);
      if (state === 'completed' && itinerary) settleSuccess(jobId, itinerary);
      else if (state === 'failed') settleFailure(jobId, error || 'Itinerary generation failed.');
    } catch (err) {
      if (err?.response?.status === 404) {
        settleFailure(jobId, 'The generation job expired before it could be delivered.');
      }
    }
  }, [settleSuccess, settleFailure]);

  const handleStartAIGeneration = useCallback(async (form) => {
    clearGenerationTimers();
    activeJobIdRef.current = null;
    lastRequestRef.current = form;

    setIsGeneratingAI(true);
    setGeneratedItinerary(null);
    setAiError(null);
    setAiProgress(5);

    const payload = {
      ...form,
      destination: normalizePlaceName(form.destination),
      origin: normalizePlaceName(form.origin || 'Delhi'),
      days: Number(form.days) || 3,
    };

    let jobId;
    try {
      jobId = (await tripsApi.generate(payload)).jobId;
      if (!jobId) throw new Error('The server accepted the request but returned no job id.');
    } catch (err) {
      settleFailure(null, extractApiError(
        err,
        'Could not reach the generation service. Check the backend is running and try again.'
      ));
      return;
    }

    activeJobIdRef.current = jobId;
    timeoutRef.current = setTimeout(() => {
      settleFailure(jobId, 'Generation is taking longer than expected and has timed out.');
    }, AI_GENERATION_TIMEOUT_MS);
    pollRef.current = setInterval(() => pollGenerationStatus(jobId), AI_POLL_INTERVAL_MS);
  }, [clearGenerationTimers, settleFailure, pollGenerationStatus]);

  const handleRetryGeneration = useCallback(() => {
    if (lastRequestRef.current) handleStartAIGeneration(lastRequestRef.current);
  }, [handleStartAIGeneration]);

  // ------------------------------------------------------------------ socket

  /**
   * The socket carries BOTH credentials, and the server prefers the token.
   *
   * `currentUserId` is in the dependency array on purpose: the room you join is
   * decided at handshake time. Sign in on an open tab and, without this, the
   * socket stays in the old guest room while the API now generates trips under
   * the account id — the itinerary completes and the event is delivered to a
   * room nobody is listening in. Reconnecting on identity change is what keeps
   * the two halves agreeing on who you are.
   */
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { userId: getUserId(), token: getToken() },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on(SOCKET_EVENTS.ITINERARY_GENERATED, ({ jobId, itinerary }) => settleSuccess(jobId, itinerary));
    socket.on(SOCKET_EVENTS.ITINERARY_GENERATION_FAILED, ({ jobId, error }) =>
      settleFailure(jobId, error || 'The itinerary generation workflow failed.'));

    return () => socket.disconnect();
  }, [settleSuccess, settleFailure, currentUserId]);

  useEffect(() => clearGenerationTimers, [clearGenerationTimers]);

  const openBooking = (serviceType, id, title, amount) =>
    setBookingItem({ serviceType, id, title, amount });

  // ----------------------------------------------------------------- render

  const renderList = () => {
    if (loading) return <SkeletonList count={4} label={`Loading ${activeTab}`} />;

    if (loadError) {
      return <ErrorState message={loadError} onRetry={retryLoad} />;
    }

    if (!items.length) {
      return (
        <EmptyState
          title={`No ${activeTab} found`}
          message="Try a different city or date. If you've just set the project up, run `npm run seed` to populate the travel database."
        />
      );
    }

    if (!fs.results.length) {
      return (
        <EmptyState
          title="No matches for these filters"
          message={`All ${fs.total} results were filtered out. Loosen a filter to see them again.`}
          action={<button className="btn-primary" onClick={fs.reset}>Clear filters</button>}
        />
      );
    }

    return (
      <div className="cards-grid">
        {fs.results.map((item, i) => {
          if (activeTab === 'flights') return <FlightCard key={item._id || item.id} flight={item} onBook={openBooking} index={i} />;
          if (activeTab === 'hotels') return <HotelCard key={item._id || item.id} hotel={item} onBook={openBooking} index={i} />;
          return <CabCard key={item.id} cab={item} onBook={openBooking} index={i} />;
        })}
      </div>
    );
  };

  const isBrowseTab = activeTab !== 'ai-holidays';

  return (
    <>
      <Hero compact={hasSearched || generatedItinerary != null} />

      <ServiceTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <div style={{ marginTop: '2.5rem' }}>
        <SearchWidget
          activeTab={activeTab}
          onSearch={handleSearchSubmit}
          onGenerateAI={handleStartAIGeneration}
          generating={isGeneratingAI}
        />
      </div>

      {/* Discovery rail — ties recently-viewed and recommendations into home */}
      {activeTab === 'ai-holidays' && !generatedItinerary && !isGeneratingAI && (
        <div style={{ marginBottom: '1.75rem' }}>
          <RecentlyViewed />
          <Recommendations />
        </div>
      )}

      <div className="main-layout">
        {isBrowseTab && items.length > 0 && !loading && !loadError ? (
          <FilterSidebar
            tab={activeTab}
            filters={fs.filters}
            setFilter={fs.setFilter}
            toggleIn={fs.toggleIn}
            reset={fs.reset}
            activeCount={fs.activeCount}
            facets={fs.facets}
          />
        ) : (
          <div aria-hidden="true" />
        )}

        <main id="main" style={{ minWidth: 0 }}>
          {isBrowseTab && (
            <div
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
              tabIndex={-1}
            >
              {items.length > 0 && !loading && !loadError && (
                <SortBar
                  tab={activeTab}
                  sort={fs.sort}
                  setSort={fs.setSort}
                  sortOptions={fs.sortOptions}
                  shown={fs.results.length}
                  total={fs.total}
                  activeCount={fs.activeCount}
                  onReset={fs.reset}
                />
              )}
              <ErrorBoundary message="This list failed to render.">
                {renderList()}
              </ErrorBoundary>
            </div>
          )}

          {activeTab === 'ai-holidays' && (
            <div
              role="tabpanel"
              id="panel-ai-holidays"
              aria-labelledby="tab-ai-holidays"
              tabIndex={-1}
            >
              {isGeneratingAI && (
                <div
                  className="glass-panel state-panel"
                  aria-live="polite"
                  aria-busy="true"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.35rem' }}
                >
                  <div style={{ position: 'relative' }}>
                    <Loader2 size={56} color="var(--accent-primary)" className="spin" aria-hidden="true" />
                    <Sparkles
                      size={20} color="var(--accent-secondary)"
                      style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <h2 className="text-gradient" style={{ marginBottom: '0.4rem', fontSize: '1.5rem' }}>
                      Building your itinerary
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                      Pulling real hotels and restaurants, then planning your days around them.
                    </p>
                  </div>

                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${Math.max(aiProgress, 8)}%` }} />
                  </div>

                  <p style={{ fontSize: '0.78rem', color: socketConnected ? 'var(--text-muted)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {socketConnected
                      ? <><Wifi size={12} aria-hidden="true" /> Live updates connected</>
                      : <><WifiOff size={12} aria-hidden="true" /> Live updates unavailable — checking periodically</>}
                  </p>
                </div>
              )}

              {!isGeneratingAI && generatedItinerary && (
                <ErrorBoundary message="The itinerary failed to render.">
                  <div style={{ marginBottom: '1.25rem' }}>
                    <button className="btn-secondary" onClick={() => setGeneratedItinerary(null)}>
                      <RefreshCw size={14} aria-hidden="true" /> Plan another trip
                    </button>
                  </div>
                  <ItineraryDisplay itinerary={generatedItinerary} onBookItem={openBooking} />
                </ErrorBoundary>
              )}

              {!isGeneratingAI && !generatedItinerary && aiError && (
                <ErrorState
                  title="We couldn't generate your itinerary"
                  message={aiError}
                  onRetry={lastRequestRef.current ? handleRetryGeneration : undefined}
                />
              )}

              {!isGeneratingAI && !generatedItinerary && !aiError && (
                <EmptyState
                  icon={Sparkles}
                  title="Plan a trip with AI"
                  message="Fill in the form above. Every hotel, restaurant and attraction in your plan comes from our database — nothing is invented."
                />
              )}
            </div>
          )}
        </main>
      </div>

      <FloatingAIAssistant onQuickSelectAI={() => handleTabChange('ai-holidays')} />

      {bookingItem && (
        <BookingModal bookingItem={bookingItem} onClose={() => setBookingItem(null)} />
      )}
    </>
  );
}

/** Small count badge on the library nav link. */
function LibraryBadge() {
  const { overview } = useLibrary();
  const n = overview.saved + overview.favorites;
  if (!n) return null;
  return (
    <span className="verified-pill" style={{ color: '#c7d2fe', background: 'var(--accent-primary-soft)', borderColor: 'rgba(99,102,241,0.3)' }}>
      {n}
    </span>
  );
}

/**
 * Provider order matters: AuthProvider must wrap LibraryProvider, because the
 * library only has data once we know who is signed in. Nesting them the other
 * way round makes the library fetch on mount as a guest, 401, and then need a
 * second fetch after auth resolves.
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <LibraryProvider>
      <a className="skip-link" href="#main">Skip to main content</a>

      <div className="app-container">
        <header className="header">
          <Link to="/" className="brand-logo">
            <div className="brand-mark" aria-hidden="true">
              <Plane size={19} color="white" />
            </div>
            <span className="brand-name">Velora</span>
          </Link>

          <nav className="header-actions" aria-label="Main">
            <button className="header-chip header-chip--currency" type="button">
              <Globe size={15} aria-hidden="true" /> INR ₹
            </button>
            <NavLink to="/library" className="header-chip">
              <LibraryIcon size={15} color="var(--accent-primary)" aria-hidden="true" />
              <span>My Library</span>
              <LibraryBadge />
            </NavLink>
            <AccountMenu />
          </nav>
        </header>

        <ErrorBoundary message="Velora hit an unexpected error.">
          <Routes>
            <Route path="/" element={<MainPortal />} />
            <Route path="/library" element={<Library />} />
            <Route path="/trip/:id" element={<TripPage />} />
            {/* Public — no identity needed, the token is the credential. */}
            <Route path="/shared/:token" element={<TripPage shared />} />
            <Route path="/destination/:citySlug" element={<DestinationPage />} />
          </Routes>
        </ErrorBoundary>
      </div>

      {/* Rendered once at the root so any component can open it. */}
      <AuthModal />
      </LibraryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

/** Sign-in button, or the current user with a sign-out control. */
function AccountMenu() {
  const { user, loading, openAuth, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Close on outside click, so the menu doesn't linger when attention moves on.
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  // Render nothing rather than "Sign in" while /me is still in flight —
  // otherwise a signed-in user sees the button flash on every page load.
  if (loading) return <span className="header-chip header-chip--ghost" aria-hidden="true" />;

  if (!user) {
    return (
      <button type="button" className="header-chip header-chip--signin" onClick={() => openAuth('login')}>
        <LogIn size={15} aria-hidden="true" />
        <span>Sign in</span>
      </button>
    );
  }

  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="account-menu" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="header-chip account-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="account-avatar" aria-hidden="true">{initial}</span>
        <span className="account-menu__name">{user.name}</span>
      </button>

      {open && (
        <div className="account-menu__panel" role="menu">
          <div className="account-menu__header">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <NavLink to="/library" role="menuitem" onClick={() => setOpen(false)}>
            <LibraryIcon size={15} aria-hidden="true" /> My Library
          </NavLink>
          <button type="button" role="menuitem" onClick={logout}>
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
