import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, CloudSun, ListChecks, Plus, Check, Loader2, CalendarCheck, AlertTriangle,
} from 'lucide-react';
import { discover } from '../api/client';
import { ErrorState } from './states';

/**
 * ============================================================================
 * TRIP PLANNING WIDGETS
 * ============================================================================
 * Budget calculator, weather panel and travel checklist. Grouped because
 * they're the same kind of thing — per-trip planning tools that hang off a
 * destination or an itinerary.
 * ============================================================================
 */

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/* ------------------------------------------------------------------ budget */

export function BudgetCalculator({ citySlug, initialDays = 3, initialTravellers = 2, initialTier = 'moderate' }) {
  const [days, setDays] = useState(initialDays);
  const [travellers, setTravellers] = useState(initialTravellers);
  const [tier, setTier] = useState(initialTier);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await discover.budget(citySlug, { days, travellers, budgetTier: tier }));
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not calculate a budget.');
    } finally {
      setLoading(false);
    }
  }, [citySlug, days, travellers, tier]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState title="Budget unavailable" message={error} onRetry={load} />;

  const maxAmount = data ? Math.max(...data.breakdown.map((b) => b.amount)) : 1;

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <h4 style={{ color: 'white', fontSize: '1.05rem', marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Wallet size={17} color="var(--success)" aria-hidden="true" /> Budget calculator
      </h4>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.7rem', marginBottom: '1.25rem' }}>
        <div className="input-box">
          <label className="input-label" htmlFor="budget-days">Days</label>
          <input id="budget-days" className="input-field" type="number" min="1" max="30"
            value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div className="input-box">
          <label className="input-label" htmlFor="budget-travellers">Travellers</label>
          <input id="budget-travellers" className="input-field" type="number" min="1" max="20"
            value={travellers} onChange={(e) => setTravellers(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div className="input-box">
          <label className="input-label" htmlFor="budget-tier">Style</label>
          <select id="budget-tier" className="input-field" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="budget">Budget</option>
            <option value="moderate">Moderate</option>
            <option value="luxury">Luxury</option>
          </select>
        </div>
      </div>

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <Loader2 size={22} className="spin" color="var(--accent-primary)" aria-hidden="true" />
        </div>
      ) : data && (
        <div aria-live="polite">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
            {data.breakdown.map((b) => (
              <div key={b.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {b.label} <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>· {b.detail}</span>
                  </span>
                  <strong style={{ color: 'white' }}>{inr(b.amount)}</strong>
                </div>
                {/* Bar chart makes the proportions obvious at a glance. */}
                <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(b.amount / maxAmount) * 100}%`,
                    background: 'var(--accent-gradient)', borderRadius: 999,
                    transition: 'width var(--dur-base) var(--ease-out)',
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{
            borderTop: '1px solid var(--border-glass)', paddingTop: '1rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total trip cost</div>
              <div className="card-price" style={{ fontSize: '1.75rem', color: 'var(--success)' }}>{inr(data.total)}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <div>{inr(data.perPerson)} per person</div>
              <div style={{ color: 'var(--text-muted)' }}>{inr(data.perPersonPerDay)} per day each</div>
            </div>
          </div>

          {/* Says where the numbers came from, so they're not mistaken for quotes. */}
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.85rem', lineHeight: 1.5 }}>
            Estimated from {data.basedOn}. Indicative only — not a quote.
          </p>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- weather */

export function WeatherPanel({ citySlug, month }) {
  const [selected, setSelected] = useState(month || MONTHS[new Date().getMonth()]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    discover.weather(citySlug, selected)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.response?.data?.message || 'Weather unavailable.'));
    return () => { alive = false; };
  }, [citySlug, selected]);

  if (error) return null;   // weather is enrichment; never block the page for it

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h4 style={{ color: 'white', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CloudSun size={17} color="#60a5fa" aria-hidden="true" /> Typical weather
        </h4>
        <select
          className="input-field"
          style={{ width: 'auto', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-xs)', padding: '0.35rem 0.6rem' }}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Month"
        >
          {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {!data ? (
        <div className="skeleton-pulse" style={{ height: 70, borderRadius: 'var(--radius-sm)' }} />
      ) : (
        <div aria-live="polite">
          {data.current ? (
            <div style={{
              background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '0.85rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                <strong style={{ color: 'white' }}>{data.current.season}</strong>
                <span style={{ color: '#93c5fd', fontWeight: 600 }}>{data.current.temperatureRange}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {data.current.description}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              {data.overview || 'No seasonal detail recorded for this destination yet.'}
            </p>
          )}

          {data.isGoodTime !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem',
              color: data.isGoodTime ? 'var(--success)' : 'var(--warning)', marginBottom: '0.75rem',
            }}>
              <CalendarCheck size={14} aria-hidden="true" />
              {data.isGoodTime
                ? `${selected} is a good time to visit`
                : `${selected} isn't peak season${data.bestSeason?.recommendedMonths ? ` — try ${data.bestSeason.recommendedMonths}` : ''}`}
            </div>
          )}

          {/* This is the honest bit. Monthly climate normals are not a forecast. */}
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
            <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            Typical conditions for this month, not a live forecast. Check a weather service near your travel date.
          </p>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- checklist */

export function TravelChecklist({ itineraryId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newLabel, setNewLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discover.checklist(itineraryId);
      setItems(res.items || []);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load your checklist.');
    } finally {
      setLoading(false);
    }
  }, [itineraryId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (item) => {
    // Optimistic — a checkbox must respond instantly.
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await discover.toggleChecklistItem(itineraryId, item.id, !item.done);
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    setNewLabel('');
    try {
      const item = await discover.addChecklistItem(itineraryId, label);
      setItems((prev) => [...prev, item]);
    } catch { /* the input keeps its value on failure via the catch above */ }
  };

  if (error) return <ErrorState title="Checklist unavailable" message={error} onRetry={load} />;

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  // Group by category so a 20-item list reads as sections, not a wall.
  const grouped = items.reduce((acc, i) => {
    (acc[i.category] ||= []).push(i);
    return acc;
  }, {});

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h4 style={{ color: 'white', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ListChecks size={17} color="#22d3ee" aria-hidden="true" /> Travel checklist
        </h4>
        <span style={{ fontSize: '0.85rem', color: pct === 100 ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600 }}>
          {done} / {items.length} done
        </span>
      </div>

      <div className="progress-track" style={{ maxWidth: 'none', marginBottom: '1.25rem' }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--success)' : undefined }} />
      </div>

      {loading ? (
        <div className="skeleton-pulse" style={{ height: 120, borderRadius: 'var(--radius-sm)' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {Object.entries(grouped).map(([category, group]) => (
            <div key={category}>
              <div className="filter-title" style={{ marginBottom: '0.5rem' }}>{category}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {group.map((item) => (
                  <label key={item.id} className="filter-checkbox" style={{ gap: '0.65rem' }}>
                    <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
                    <span style={{
                      textDecoration: item.done ? 'line-through' : 'none',
                      opacity: item.done ? 0.55 : 1,
                      transition: 'opacity var(--dur-fast) var(--ease-out)',
                    }}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
        <input
          className="input-field"
          style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-xs)', padding: '0.55rem 0.75rem' }}
          placeholder="Add your own item…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          maxLength={120}
          aria-label="New checklist item"
        />
        <button className="btn-secondary" type="submit" disabled={!newLabel.trim()} aria-label="Add checklist item">
          <Plus size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
