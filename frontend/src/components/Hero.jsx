import React from 'react';
import { Sparkles, ShieldCheck, Globe2 } from 'lucide-react';

/**
 * Landing hero.
 *
 * The app previously opened straight onto a tab bar with no explanation of
 * what it does. This gives it a first screen — and leads with the actual
 * differentiator (plans built from real inventory, not invented places)
 * rather than generic travel copy.
 *
 * Collapses to a compact strip once the user has started searching, so it
 * never gets in the way of results.
 */
export default function Hero({ compact = false, stats }) {
  if (compact) return null;

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-orb hero-orb--a" aria-hidden="true" />
      <div className="hero-orb hero-orb--b" aria-hidden="true" />

      <div style={{ position: 'relative' }}>
        <span className="hero-eyebrow">
          <Sparkles size={13} aria-hidden="true" />
          AI plans grounded in real inventory
        </span>

        <h1 id="hero-title" className="hero-title">
          Travel plans that actually
          <br />
          <span className="text-gradient">exist</span>
        </h1>

        <p className="hero-sub">
          Most AI trip planners invent hotels. Velora builds your day-by-day itinerary
          from real, bookable places in our database — then verifies every single one
          before showing it to you.
        </p>

        <div className="hero-stats">
          {[
            { icon: Globe2, value: stats?.destinations ?? '171', label: 'Destinations' },
            { icon: ShieldCheck, value: stats?.verified ?? '100%', label: 'Verified venues' },
            { icon: Sparkles, value: stats?.countries ?? '38', label: 'Countries' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label}>
              <div className="hero-stat-value">
                <Icon size={15} style={{ verticalAlign: -1, marginRight: 5, color: 'var(--accent-primary)' }} aria-hidden="true" />
                {value}
              </div>
              <div className="hero-stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
