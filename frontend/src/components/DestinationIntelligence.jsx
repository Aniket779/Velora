import React, { useState } from 'react';
import {
  BookOpen, Utensils, PartyPopper, MapPin, Gem, Sparkles, Bus, ShoppingBag,
  CloudSun, CalendarCheck, ShieldAlert, AlertTriangle, Phone, HandHeart,
  Wallet, Luggage, Info,
} from 'lucide-react';

/**
 * Renders the 18-category destination briefing.
 *
 * Grouped into five tabs rather than one long scroll — 18 categories presented flat
 * is a wall of text nobody reads. Grouping matches how people actually plan:
 * understand the place, then eat, then move, then stay safe, then pack.
 */

const panel = { padding: '1.75rem', marginBottom: '1.25rem' };
const h4 = {
  fontSize: '1.1rem', color: 'white', marginBottom: '0.85rem',
  display: 'flex', alignItems: 'center', gap: '0.5rem',
};
const body = { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.65 };
const chip = (bg, border, color) => ({
  background: bg, border: `1px solid ${border}`, color,
  padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-full)',
  fontWeight: 600, fontSize: '0.82rem',
});

const GROUPS = [
  { id: 'about', label: 'About', icon: BookOpen },
  { id: 'food', label: 'Food & Festivals', icon: Utensils },
  { id: 'explore', label: 'Explore', icon: MapPin },
  { id: 'practical', label: 'Getting Around', icon: Bus },
  { id: 'safety', label: 'Safety & Etiquette', icon: ShieldAlert },
  { id: 'plan', label: 'Budget & Packing', icon: Wallet },
];

const Section = ({ icon: Icon, title, color, children }) => (
  <div className="glass-panel" style={panel}>
    <h4 style={h4}><Icon size={18} color={color} /> {title}</h4>
    {children}
  </div>
);

const Bullets = ({ items, color = 'var(--accent-primary)' }) => (
  <ul style={{ ...body, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
    {(items || []).map((item, i) => (
      <li key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
        <span style={{ color, marginTop: '2px' }}>▸</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

export default function DestinationIntelligence({ intelligence, meta, destination }) {
  const [group, setGroup] = useState('about');
  if (!intelligence) return null;

  const i = intelligence;

  return (
    <div>
      {meta?.isMock && (
        <div className="glass-panel" style={{ ...panel, borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.08)' }}>
          <h4 style={{ ...h4, color: '#fbbf24' }}><AlertTriangle size={18} /> Placeholder content</h4>
          <p style={body}>
            This briefing was not AI-generated — <code>OPENAI_API_KEY</code> is not configured on the
            server. Set it and regenerate for real destination research.
          </p>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Destination guide sections"
        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', justifyContent: 'center' }}
      >
        {GROUPS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`service-tab ${group === id ? 'active' : ''}`}
            role="tab"
            aria-selected={group === id}
            onClick={() => setGroup(id)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {group === 'about' && (
        <>
          <Section icon={BookOpen} title={`The story of ${destination}`} color="var(--accent-primary)">
            <p style={body}>{i.history}</p>
          </Section>
          <Section icon={HandHeart} title="Culture" color="#a855f7">
            <p style={{ ...body, marginBottom: i.traditions?.length ? '1rem' : 0 }}>{i.culture}</p>
            {i.traditions?.length > 0 && (
              <>
                <div style={{ ...h4, fontSize: '0.95rem', marginTop: '1rem' }}>Living traditions</div>
                <Bullets items={i.traditions} color="#a855f7" />
              </>
            )}
          </Section>
        </>
      )}

      {group === 'food' && (
        <>
          <Section icon={Utensils} title="Must-try dishes" color="#f59e0b">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {(i.famousFoods || []).map((f, idx) => (
                <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <h5 style={{ color: 'white', fontSize: '1rem' }}>{f.name}</h5>
                    {f.vegetarian && <span style={chip('rgba(34,197,94,0.15)', 'rgba(34,197,94,0.35)', '#4ade80')}>veg</span>}
                  </div>
                  <p style={{ ...body, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{f.description}</p>
                  <p style={{ fontSize: '0.8rem', color: '#fcd34d' }}>📍 {f.whereToTry}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={PartyPopper} title="Festivals worth planning around" color="#ec4899">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(i.festivals || []).map((f, idx) => (
                <div key={idx} style={{ borderLeft: '3px solid #ec4899', paddingLeft: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <h5 style={{ color: 'white', fontSize: '1rem' }}>{f.name}</h5>
                    <span style={{ fontSize: '0.78rem', color: '#f9a8d4' }}>{f.months}</span>
                  </div>
                  <p style={{ ...body, fontSize: '0.85rem' }}>{f.description}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {group === 'explore' && (
        <>
          <Section icon={MapPin} title="Famous places" color="var(--accent-primary)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {(i.famousPlaces || []).map((p, idx) => (
                <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <h5 style={{ color: 'white', fontSize: '1rem', marginBottom: '0.4rem' }}>{p.name}</h5>
                  <p style={{ ...body, fontSize: '0.85rem' }}>{p.whyVisit}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={Gem} title="Hidden gems" color="#22d3ee">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {(i.hiddenGems || []).map((g, idx) => (
                <div key={idx} style={{ background: 'rgba(34,211,238,0.06)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(34,211,238,0.25)' }}>
                  <h5 style={{ color: 'white', fontSize: '1rem', marginBottom: '0.4rem' }}>{g.name}</h5>
                  <p style={{ ...body, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{g.whyVisit}</p>
                  <p style={{ fontSize: '0.78rem', color: '#67e8f9' }}>🧭 {g.howToReach}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={Sparkles} title="Local experiences" color="#a855f7">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {(i.localExperiences || []).map((e, idx) => (
                <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <h5 style={{ color: 'white', fontSize: '0.98rem', marginBottom: '0.4rem' }}>{e.name}</h5>
                  <p style={{ ...body, fontSize: '0.85rem' }}>{e.description}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {group === 'practical' && (
        <>
          <Section icon={Bus} title="Getting around" color="#14b8a6">
            <p style={{ ...body, marginBottom: '1rem' }}>{i.transportation?.gettingAround}</p>
            <div style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
              <strong style={{ color: '#5eead4', fontSize: '0.85rem' }}>From the airport:</strong>
              <p style={{ ...body, fontSize: '0.87rem', marginTop: '0.3rem' }}>{i.transportation?.fromAirport}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
              {(i.transportation?.options || []).map((o, idx) => (
                <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '0.9rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <strong style={{ color: 'white', fontSize: '0.92rem' }}>{o.mode}</strong>
                    <span style={{ color: '#5eead4', fontSize: '0.82rem' }}>{o.typicalCost}</span>
                  </div>
                  <p style={{ ...body, fontSize: '0.82rem' }}>{o.tips}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={ShoppingBag} title="Shopping" color="#f472b6">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.25rem' }}>
              {(i.shopping?.whatToBuy || []).map((w, idx) => (
                <span key={idx} style={chip('rgba(244,114,182,0.12)', 'rgba(244,114,182,0.3)', '#f9a8d4')}>{w}</span>
              ))}
            </div>
            {(i.shopping?.markets || []).map((m, idx) => (
              <div key={idx} style={{ borderLeft: '3px solid #f472b6', paddingLeft: '1rem', marginBottom: '0.85rem' }}>
                <strong style={{ color: 'white', fontSize: '0.95rem' }}>{m.name}</strong>
                <p style={{ ...body, fontSize: '0.85rem' }}>{m.knownFor}</p>
              </div>
            ))}
            {i.shopping?.bargainingTips && (
              <p style={{ ...body, fontSize: '0.85rem', marginTop: '1rem', fontStyle: 'italic' }}>
                💡 {i.shopping.bargainingTips}
              </p>
            )}
          </Section>
          <Section icon={CloudSun} title="Weather" color="#60a5fa">
            <p style={{ ...body, marginBottom: '1rem' }}>{i.weather?.overview}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
              {(i.weather?.seasons || []).map((s, idx) => (
                <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '0.9rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <strong style={{ color: 'white', fontSize: '0.92rem' }}>{s.season}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#93c5fd' }}>{s.months}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#60a5fa', marginBottom: '0.3rem' }}>{s.temperatureRange}</div>
                  <p style={{ ...body, fontSize: '0.82rem' }}>{s.description}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={CalendarCheck} title="Best time to visit" color="#4ade80">
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px', padding: '1rem' }}>
                <strong style={{ color: '#4ade80', fontSize: '0.85rem' }}>GO</strong>
                <div style={{ color: 'white', fontSize: '1.05rem', margin: '0.3rem 0' }}>{i.bestSeason?.recommendedMonths}</div>
                <p style={{ ...body, fontSize: '0.85rem' }}>{i.bestSeason?.why}</p>
              </div>
              <div style={{ flex: 1, minWidth: '220px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '12px', padding: '1rem' }}>
                <strong style={{ color: '#fca5a5', fontSize: '0.85rem' }}>AVOID</strong>
                <div style={{ color: 'white', fontSize: '1.05rem', margin: '0.3rem 0' }}>{i.bestSeason?.monthsToAvoid}</div>
              </div>
            </div>
          </Section>
        </>
      )}

      {group === 'safety' && (
        <>
          <Section icon={Phone} title="Emergency numbers" color="#f87171">
            {meta?.emergencyNumbersVerified ? (
              <p style={{ fontSize: '0.8rem', color: '#4ade80', marginBottom: '0.85rem' }}>
                ✓ Verified against a curated registry
              </p>
            ) : (
              <p style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.85rem' }}>
                ⚠ Not independently verified — confirm locally on arrival
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {(i.emergencyNumbers || []).map((e, idx) => (
                <div key={idx} style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '0.85rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{e.service}</div>
                  <a href={`tel:${e.number}`} style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fca5a5', textDecoration: 'none' }}>{e.number}</a>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={ShieldAlert} title="Safety tips" color="#fbbf24">
            <Bullets items={i.safetyTips} color="#fbbf24" />
          </Section>
          <Section icon={AlertTriangle} title="Scams to avoid" color="#fb923c">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(i.scamsToAvoid || []).map((s, idx) => (
                <div key={idx} style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.28)', borderRadius: '12px', padding: '1rem' }}>
                  <h5 style={{ color: '#fdba74', fontSize: '0.98rem', marginBottom: '0.45rem' }}>{s.scam}</h5>
                  <p style={{ ...body, fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>How it works:</strong> {s.howItWorks}</p>
                  <p style={{ fontSize: '0.85rem', color: '#4ade80' }}><strong>Avoid it:</strong> {s.howToAvoid}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={HandHeart} title="Local etiquette" color="#c084fc">
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div style={{ flex: 1, minWidth: '230px' }}>
                <div style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>DO</div>
                <Bullets items={i.localEtiquette?.dos} color="#4ade80" />
              </div>
              <div style={{ flex: 1, minWidth: '230px' }}>
                <div style={{ color: '#fca5a5', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>DON'T</div>
                <Bullets items={i.localEtiquette?.donts} color="#fca5a5" />
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '230px' }}>
                <strong style={{ color: 'white', fontSize: '0.88rem' }}>Dress code</strong>
                <p style={{ ...body, fontSize: '0.85rem' }}>{i.localEtiquette?.dressCode}</p>
              </div>
              <div style={{ flex: 1, minWidth: '230px' }}>
                <strong style={{ color: 'white', fontSize: '0.88rem' }}>Tipping</strong>
                <p style={{ ...body, fontSize: '0.85rem' }}>{i.localEtiquette?.tipping}</p>
              </div>
            </div>
          </Section>
        </>
      )}

      {group === 'plan' && (
        <>
          <Section icon={Wallet} title="Daily budget estimates" color="#4ade80">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    {['Tier', 'Stay', 'Food', 'Transport', 'Activities', 'Per person / day'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(i.budgetEstimation?.dailyByTier || []).map((t, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass-light)' }}>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'white', textTransform: 'capitalize', fontWeight: 600 }}>{t.tier}</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>₹{t.accommodation?.toLocaleString()}</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>₹{t.food?.toLocaleString()}</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>₹{t.localTransport?.toLocaleString()}</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>₹{t.activities?.toLocaleString()}</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: '#4ade80', fontWeight: 700 }}>₹{t.totalPerPersonPerDay?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {i.budgetEstimation?.notes && (
              <p style={{ ...body, fontSize: '0.83rem', marginTop: '1rem', fontStyle: 'italic' }}>{i.budgetEstimation.notes}</p>
            )}
          </Section>
          <Section icon={Luggage} title="What to pack" color="#22d3ee">
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {[
                ['Essentials', i.packingSuggestions?.essentials],
                ['Seasonal', i.packingSuggestions?.seasonal],
                ['Documents', i.packingSuggestions?.documents],
              ].map(([label, items]) => (
                <div key={label} style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ color: '#67e8f9', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.55rem' }}>{label}</div>
                  <Bullets items={items} color="#22d3ee" />
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
