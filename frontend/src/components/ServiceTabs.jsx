import React from 'react';
import { Plane, Hotel, Car, Sparkles } from 'lucide-react';

export default function ServiceTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'flights', label: 'Flights', icon: Plane },
    { id: 'hotels', label: 'Hotels', icon: Hotel },
    { id: 'cabs', label: 'Cabs', icon: Car },
    { id: 'ai-holidays', label: 'AI Holidays', icon: Sparkles },
  ];

  return (
    <div className="service-tabs-container">
      <div className="service-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`service-tab ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
