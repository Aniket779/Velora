import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

/**
 * Map view.
 *
 * Two upgrades over the previous version:
 *   - a dark tile layer, so the map stops being a bright white rectangle in
 *     the middle of a dark UI
 *   - bounds fitted to the actual markers instead of a hardcoded zoom on the
 *     first item, so all results are visible whatever the city
 */

// Leaflet's default marker images don't resolve under a bundler.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/** Colour-coded pins so hotels and attractions are distinguishable. */
const pin = (color) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid rgba(255,255,255,0.85);
      box-shadow:0 3px 10px rgba(0,0,0,0.5);"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });

const ICONS = {
  hotel: pin('#6366f1'),
  place: pin('#14b8a6'),
  restaurant: pin('#f59e0b'),
};

function FitBounds({ points }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length === 1) map.setView(points[0], 13);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export default function MapView({ items, type = 'place' }) {
  const points = useMemo(
    () => (items || [])
      .filter((i) => Number.isFinite(i.latitude) && Number.isFinite(i.longitude))
      .map((i) => [i.latitude, i.longitude]),
    [items]
  );

  const mapped = useMemo(
    () => (items || []).filter((i) => Number.isFinite(i.latitude) && Number.isFinite(i.longitude)),
    [items]
  );

  if (!mapped.length) {
    return (
      <div className="glass-panel state-panel">
        <p style={{ color: 'var(--text-secondary)' }}>
          No map coordinates available for these results.
        </p>
      </div>
    );
  }

  return (
    <div className="map-shell">
      <MapContainer
        center={points[0]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}   /* don't hijack page scroll */
      >
        {/* CARTO dark tiles — matches the app rather than fighting it. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={points} />

        {mapped.map((item, idx) => (
          <Marker
            key={item._id || idx}
            position={[item.latitude, item.longitude]}
            icon={ICONS[type] || ICONS.place}
          >
            <Popup>
              <div style={{ minWidth: 170 }}>
                <h4 style={{ margin: '0 0 5px', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {item.hotelName || item.name}
                </h4>

                {item.rating != null && (
                  <div style={{ color: 'var(--accent-gold)', fontSize: '0.8rem', marginBottom: 3 }}>
                    ★ {item.rating}
                  </div>
                )}

                {(item.pricePerNight || item.priceForTwo) && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                    ₹{Number(item.pricePerNight || item.priceForTwo).toLocaleString('en-IN')}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      {item.pricePerNight ? ' / night' : ' for two'}
                    </span>
                  </p>
                )}

                {item.category && (
                  <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {item.category}
                  </p>
                )}

                <p style={{ margin: '5px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  {item.address || item.city}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
