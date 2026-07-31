import React, { useRef } from 'react';
import { Plane, Hotel, Car, Sparkles } from 'lucide-react';

const TABS = [
  { id: 'flights', label: 'Flights', icon: Plane },
  { id: 'hotels', label: 'Hotels', icon: Hotel },
  { id: 'cabs', label: 'Cabs', icon: Car },
  { id: 'ai-holidays', label: 'AI Holidays', icon: Sparkles },
];

/**
 * Service tabs.
 *
 * Now a real ARIA tablist. Previously these were plain buttons with no
 * roles, no `aria-selected`, and no keyboard support beyond Tab — a screen
 * reader announced four unlabelled buttons with no indication which was
 * active, and arrow keys did nothing.
 */
export default function ServiceTabs({ activeTab, onTabChange }) {
  const refs = useRef({});

  // Arrow-key navigation is expected behaviour for a tablist.
  const onKeyDown = (e) => {
    const i = TABS.findIndex((t) => t.id === activeTab);
    let next = null;

    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
    else if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length];
    else if (e.key === 'Home') next = TABS[0];
    else if (e.key === 'End') next = TABS[TABS.length - 1];
    else return;

    e.preventDefault();
    onTabChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className="service-tabs-container">
      <div className="service-tabs" role="tablist" aria-label="Travel services" onKeyDown={onKeyDown}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => { refs.current[tab.id] = el; }}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              /* Roving tabindex: only the active tab is in the tab order. */
              tabIndex={selected ? 0 : -1}
              className={`service-tab ${selected ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
