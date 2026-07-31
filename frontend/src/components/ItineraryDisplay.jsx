import React, { useState, lazy, Suspense } from 'react';
import {
  MapPin, Utensils, BedDouble, Navigation, Plane, Hotel, Clock, ArrowRight,
  Map, List, Eye, Info, ShoppingBag, Sparkles, Coffee, Wallet, CheckCircle2,
  Loader2,
} from 'lucide-react';
/**
 * Loaded on demand, not upfront.
 *
 * These two drag in the heaviest dependencies in the project — Leaflet for the
 * map, and Pannellum (a full 360° panorama engine) for the VR viewer. Imported
 * normally, both ship in the bundle that every first-time visitor downloads
 * before they see anything, even though the map only appears once you open an
 * itinerary and the VR viewer only when you click it.
 *
 * React.lazy splits each into its own chunk, fetched the first time it's
 * actually rendered. Both were already conditionally rendered, which is what
 * makes this safe rather than a refactor.
 */
const MapView = lazy(() => import('./MapView'));
const VRDestinationModal = lazy(() => import('./VRDestinationModal'));
import DestinationIntelligence from './DestinationIntelligence';
import { HotelCard, FlightCard, RestaurantCard, PlaceCard } from './cards';
import { EmptyState } from './states';

export default function ItineraryDisplay({ itinerary, onBookItem }) {
  // All hooks must run unconditionally and in a stable order. Previously two of
  // these were declared AFTER an early `if (!itinerary) return null`, so the hook
  // count changed between renders — React throws "Rendered more hooks than during
  // the previous render" the moment the itinerary goes from null to populated.
  // That transition is now routine (generate -> clear -> regenerate), so what was a
  // latent landmine became a reachable crash.
  const [activeCategory, setActiveCategory] = useState(null);
  const [visibleCounts, setVisibleCounts] = useState({ flights: 4, hotels: 4, restaurants: 4, places: 4 });
  // Separate view state per section. A single shared `viewMode` meant switching
  // Hotels to map view silently switched Sightseeing to map view as well.
  const [hotelView, setHotelView] = useState('list');
  const [placeView, setPlaceView] = useState('list');
  const [showVR, setShowVR] = useState(false);

  if (!itinerary) return null;

  const { days, trip_title, travelData } = itinerary;
  const destination = itinerary.destination || travelData?.destination || 'Destination';
  const origin = itinerary.origin || travelData?.origin || 'Delhi';

  const hotels = travelData?.hotels || [];
  const restaurants = travelData?.restaurants || [];
  const places = travelData?.places || [];
  const flights = travelData?.flights || [];
  const destinationInfo = travelData?.destinationInfo || null;

  // The 18-category briefing, plus provenance so unverified content can be labelled.
  const intelligence = itinerary.destinationIntelligence || destinationInfo || null;
  const intelligenceMeta = itinerary.intelligenceMeta || null;
  const profile = itinerary.profile || null;
  const personalisationNotes = itinerary.personalisationNotes || [];
  const totalCost = itinerary.totalEstimatedCostInr;
  const groundingStats = itinerary.generationMeta?.groundingStats || null;

  // Which tab opens first.
  //
  // The guide only leads when it contains REAL research. When OPENAI_API_KEY
  // isn't configured the briefing is placeholder text, and opening on it means
  // the first thing you see after a 30-second wait is "[placeholder — set
  // OPENAI_API_KEY]" — the least useful content in the whole result.
  //
  // The day plan is grounded in real seeded inventory and is genuinely useful
  // with or without an API key, so it leads in that case.
  const briefingIsReal = Boolean(intelligence) && !intelligenceMeta?.isMock;
  const resolvedCategory = activeCategory ?? (briefingIsReal ? 'guide' : 'schedule');

  const showMore = (category) => {
    setVisibleCounts((prev) => ({ ...prev, [category]: prev[category] + 4 }));
  };

  const getIcon = (type) => {
    switch(type) {
      case 'hotel': return <BedDouble size={18} color="var(--accent-secondary)" />;
      case 'food': return <Utensils size={18} color="#f59e0b" />;
      case 'activity': return <MapPin size={18} color="var(--accent-primary)" />;
      case 'transit': return <Navigation size={18} color="var(--text-secondary)" />;
      case 'shopping': return <ShoppingBag size={18} color="#f472b6" />;
      case 'experience': return <Sparkles size={18} color="#22d3ee" />;
      case 'rest': return <Coffee size={18} color="#94a3b8" />;
      default: return <MapPin size={18} />;
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '2rem auto' }}>
      {/* Title Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>
          <span className="text-gradient">{trip_title || `Trip to ${destination}`}</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1rem' }}>
          <strong style={{ color: 'white' }}>{origin}</strong> ➔ <strong style={{ color: 'white' }}>{destination}</strong>
          {profile && <> • {profile.days} days • {profile.travellerType} • {profile.budget}</>}
        </p>

        {itinerary.summary && (
          <p style={{ color: 'var(--text-secondary)', maxWidth: '760px', margin: '0 auto 1.25rem auto', lineHeight: 1.65, fontSize: '0.95rem' }}>
            {itinerary.summary}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {typeof totalCost === 'number' && totalCost > 0 && (
            <span style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', padding: '0.45rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Wallet size={14} /> Est. ₹{totalCost.toLocaleString()} total
            </span>
          )}
          {groundingStats && groundingStats.referencedActivities > 0 && (
            <span
              title="Activities linked to real records in the Velora database rather than invented by the model"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '0.45rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <CheckCircle2 size={14} /> {groundingStats.referencedActivities}/{groundingStats.totalActivities} verified from database
            </span>
          )}
        </div>

        {personalisationNotes.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
            {personalisationNotes.map((note, i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.78rem' }}>
                {note}
              </span>
            ))}
          </div>
        )}
      </div>

      {showVR && intelligence && (
        // Suspense is required, not optional — a lazy component rendered
        // without a boundary above it throws instead of waiting.
        <Suspense fallback={<div className="modal-backdrop"><Loader2 size={28} className="spin" /></div>}>
          <VRDestinationModal destination={{ ...intelligence, cityName: intelligence.cityName || destination }} onClose={() => setShowVR(false)} />
        </Suspense>
      )}

      {/* Category Navigation Pills */}
      <div
        role="tablist"
        aria-label="Itinerary sections"
        style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}
      >
        {intelligence && (
          <button 
            role="tab"
            aria-selected={resolvedCategory === 'guide'}
            className={`service-tab ${resolvedCategory === 'guide' ? 'active' : ''}`}
            onClick={() => setActiveCategory('guide')}
          >
            <Info size={16} /> Destination Guide
          </button>
        )}
        <button 
          role="tab"
          aria-selected={resolvedCategory === 'schedule'}
          className={`service-tab ${resolvedCategory === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveCategory('schedule')}
        >
          <Clock size={16} /> Day Plan ({days?.length || 0} Days)
        </button>
        <button 
          role="tab"
          aria-selected={resolvedCategory === 'flights'}
          className={`service-tab ${resolvedCategory === 'flights' ? 'active' : ''}`}
          onClick={() => setActiveCategory('flights')}
        >
          <Plane size={16} /> Flights ({flights.length})
        </button>
        <button 
          role="tab"
          aria-selected={resolvedCategory === 'hotels'}
          className={`service-tab ${resolvedCategory === 'hotels' ? 'active' : ''}`}
          onClick={() => setActiveCategory('hotels')}
        >
          <Hotel size={16} /> Hotels ({hotels.length})
        </button>
        <button 
          role="tab"
          aria-selected={resolvedCategory === 'restaurants'}
          className={`service-tab ${resolvedCategory === 'restaurants' ? 'active' : ''}`}
          onClick={() => setActiveCategory('restaurants')}
        >
          <Utensils size={16} /> Restaurants ({restaurants.length})
        </button>
        <button 
          role="tab"
          aria-selected={resolvedCategory === 'places'}
          className={`service-tab ${resolvedCategory === 'places' ? 'active' : ''}`}
          onClick={() => setActiveCategory('places')}
        >
          <MapPin size={16} /> Sightseeing ({places.length})
        </button>
      </div>

      {/* 0. Destination Guide — the 18 knowledge categories */}
      {resolvedCategory === 'guide' && intelligence && (
        <div>
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.5rem', background: 'linear-gradient(180deg, rgba(20, 184, 166, 0.1) 0%, transparent 100%)' }}>
            <h3 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '0.75rem' }}>
              Welcome to {intelligence.cityName || destination}
            </h3>
            {intelligence.oneLineSummary && (
              <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto 1.5rem auto', lineHeight: 1.6 }}>
                {intelligence.oneLineSummary}
              </p>
            )}
            {intelligence.vrImageUrl && (
              <button
                className="btn-primary"
                onClick={() => setShowVR(true)}
                style={{ background: 'linear-gradient(135deg, #14b8a6, #2563eb)', boxShadow: '0 4px 15px rgba(20, 184, 166, 0.4)', padding: '0.8rem 2rem', fontSize: '1rem' }}
              >
                <Eye size={18} /> Experience {intelligence.cityName || destination} in 360° VR
              </button>
            )}
          </div>

          <DestinationIntelligence
            intelligence={intelligence}
            meta={intelligenceMeta}
            destination={intelligence.cityName || destination}
          />
        </div>
      )}

      {/* 1. Day-by-day plan */}
      {resolvedCategory === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {days && days.map((day) => (
            <div key={day.day_number} className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ color: 'white', marginBottom: '0.15rem' }}>Day {day.day_number}</h3>
                  {day.theme && <p style={{ fontSize: '0.85rem', color: '#a5b4fc' }}>{day.theme}</p>}
                </div>
                {typeof day.daily_budget_estimate_inr === 'number' && day.daily_budget_estimate_inr > 0 && (
                  <span style={{ fontSize: '0.82rem', color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.28)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                    ≈ ₹{day.daily_budget_estimate_inr.toLocaleString()}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {day.activities && day.activities.map((activity, index) => (
                  <div key={index}>
                    {activity.travel_from_previous && index > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.75rem 76px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Navigation size={11} /> {activity.travel_from_previous}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ minWidth: '60px', textAlign: 'right', paddingTop: '10px' }}>
                        <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>{activity.start_time}</div>
                        {activity.end_time && <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{activity.end_time}</div>}
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', flex: 1, border: '1px solid var(--border-glass)', display: 'flex', gap: '1rem' }}>
                        {/* Real image from the referenced database record */}
                        {activity.resolved?.image ? (
                          <img
                            src={activity.resolved.image}
                            alt={activity.resolved.name || activity.title}
                            style={{ width: '92px', height: '92px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', height: 'fit-content' }}>
                            {getIcon(activity.type)}
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>{activity.title}</h4>
                            {/* Only shown when the activity resolved to a real DB record */}
                            {activity.resolved && (
                              <span
                                title="Linked to a real record in the Velora database"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#4ade80', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}
                              >
                                <CheckCircle2 size={10} /> verified
                              </span>
                            )}
                            {activity.booking_required && (
                              <span style={{ fontSize: '0.68rem', color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                                booking needed
                              </span>
                            )}
                          </div>

                          <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} /> {activity.resolved?.name || activity.location_name}
                            {activity.resolved?.rating != null && (
                              <span style={{ color: '#fde047', marginLeft: '0.4rem' }}>★ {activity.resolved.rating}</span>
                            )}
                          </p>

                          {activity.description && (
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                              {activity.description}
                            </p>
                          )}

                          {/* Why this was chosen for THIS traveller — the adaptation made visible */}
                          {activity.why_chosen && (
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', color: '#a5b4fc', fontStyle: 'italic', borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.6rem' }}>
                              {activity.why_chosen}
                            </p>
                          )}

                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                            {activity.duration_minutes > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Clock size={11} /> {Math.floor(activity.duration_minutes / 60) > 0 ? `${Math.floor(activity.duration_minutes / 60)}h ` : ''}{activity.duration_minutes % 60}m
                              </span>
                            )}
                            {activity.estimated_cost_inr > 0 && (
                              <span style={{ color: '#4ade80', fontWeight: 600 }}>₹{activity.estimated_cost_inr.toLocaleString()}</span>
                            )}
                            {activity.resolved && onBookItem && ['hotel', 'flight'].includes(activity.resolved.kind) && (
                              <button
                                className="btn-primary"
                                style={{ padding: '0.28rem 0.8rem', fontSize: '0.75rem', marginLeft: 'auto' }}
                                onClick={() => onBookItem(
                                  activity.resolved.kind === 'hotel' ? 'Hotel' : 'Flight',
                                  activity.resolved.id,
                                  activity.resolved.name,
                                  activity.resolved.price || 0
                                )}
                              >
                                Book <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {day.notes && (
                <p style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-glass-light)', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {day.notes}
                </p>
              )}
            </div>
          ))}

          {(itinerary.packingReminders || []).length > 0 && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h4 style={{ color: 'white', fontSize: '1.05rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={17} color="#22d3ee" /> Before you go
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {itinerary.packingReminders.map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.55rem', fontSize: '0.87rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#22d3ee' }}>▸</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 2. Flights Category */}
      {/* 2-5. Inventory tabs — all four now use the shared card components,
           so a hotel looks identical here and in the browse tab. */}
      {resolvedCategory === 'flights' && (
        <InventorySection
          title={`Flights ${origin} to ${destination}`}
          items={flights}
          visible={visibleCounts.flights}
          onShowMore={() => showMore('flights')}
          emptyMessage="No flights seeded for this route yet."
          render={(f, i) => <FlightCard key={f._id || i} flight={f} onBook={onBookItem} index={i} />}
        />
      )}

      {resolvedCategory === 'hotels' && (
        <InventorySection
          title={`Stays in ${destination}`}
          items={hotels}
          visible={visibleCounts.hotels}
          onShowMore={() => showMore('hotels')}
          emptyMessage="No hotels seeded for this destination yet."
          viewMode={hotelView}
          onViewMode={setHotelView}
          mapType="hotel"
          render={(h, i) => <HotelCard key={h._id || i} hotel={h} onBook={onBookItem} index={i} />}
        />
      )}

      {resolvedCategory === 'restaurants' && (
        <InventorySection
          title={`Where to eat in ${destination}`}
          items={restaurants}
          visible={visibleCounts.restaurants}
          onShowMore={() => showMore('restaurants')}
          emptyMessage="No restaurants seeded for this destination yet."
          render={(r, i) => <RestaurantCard key={r._id || i} restaurant={r} index={i} />}
        />
      )}

      {resolvedCategory === 'places' && (
        <InventorySection
          title={`Things to do in ${destination}`}
          items={places}
          visible={visibleCounts.places}
          onShowMore={() => showMore('places')}
          emptyMessage="No attractions seeded for this destination yet."
          viewMode={placeView}
          onViewMode={setPlaceView}
          mapType="place"
          render={(p, i) => <PlaceCard key={p._id || i} place={p} index={i} />}
        />
      )}
    </div>
  );
}

/**
 * One section wrapper for all four inventory tabs.
 *
 * Previously each tab repeated its own header, list/map toggle, "load more"
 * button and empty state — four near-identical copies. Two of them also shared
 * a single `viewMode` state, so switching Hotels to map view silently switched
 * Sightseeing too. Each section now owns its own view state.
 */
function InventorySection({
  title, items, visible, onShowMore, emptyMessage,
  render, viewMode, onViewMode, mapType,
}) {
  const hasMap = Boolean(onViewMode);

  if (!items.length) {
    return <EmptyState title={title} message={emptyMessage} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'white' }}>
          {title} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({items.length})</span>
        </h3>

        {hasMap && (
          <div style={{ display: 'flex', gap: '0.4rem' }} role="group" aria-label="View mode">
            <button
              className="btn-icon"
              aria-pressed={viewMode === 'list'}
              aria-label="List view"
              onClick={() => onViewMode('list')}
            >
              <List size={15} aria-hidden="true" />
            </button>
            <button
              className="btn-icon"
              aria-pressed={viewMode === 'map'}
              aria-label="Map view"
              onClick={() => onViewMode('map')}
            >
              <Map size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {hasMap && viewMode === 'map' ? (
        <Suspense fallback={<div className="map-loading"><Loader2 size={22} className="spin" /> Loading map…</div>}>
          <MapView items={items} type={mapType} />
        </Suspense>
      ) : (
        <>
          <div className="cards-grid">{items.slice(0, visible).map(render)}</div>
          {visible < items.length && (
            <button className="btn-secondary" onClick={onShowMore} style={{ display: 'flex', margin: '1.25rem auto 0' }}>
              Show {Math.min(4, items.length - visible)} more
            </button>
          )}
        </>
      )}
    </div>
  );
}
