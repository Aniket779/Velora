import React, { useState } from 'react';
import { Bot, Sparkles, X, Send, Compass } from 'lucide-react';

export default function FloatingAIAssistant({ onQuickSelectAI }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hi! I am Velora AI Assistant. Need help customizing your trip or finding flight/hotel packages?' }
  ]);

  const handleSend = (textToSend) => {
    const text = textToSend || inputMsg;
    if (!text.trim()) return;

    const userMsg = { sender: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInputMsg('');

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { 
          sender: 'bot', 
          text: `Got it! I am tailoring options for "${text}". Try using our AI Holidays tab above to generate a custom itinerary!` 
        }
      ]);
    }, 800);
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      <button 
        className="floating-bot-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        title="Customise my trip"
      >
        <Bot size={22} />
        <span>Customise my trip</span>
        <Sparkles size={16} />
      </button>

      {/* Bot Chat Drawer */}
      {isOpen && (
        <div className="bot-modal-container glass-panel">
          <div style={{ 
            background: 'var(--accent-gradient-teal)', padding: '1rem', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Bot size={20} /> Velora AI Travel Copilot
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ padding: '1rem', height: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{ 
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '0.65rem 0.85rem',
                borderRadius: '12px',
                fontSize: '0.85rem',
                background: m.sender === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
                color: 'white'
              }}>
                {m.text}
              </div>
            ))}
          </div>

          {/* Quick Prompts */}
          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border-glass-light)', display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
            {['Plan Kyoto Trip', 'Best Hotels in Manali', 'Book Airport Cab'].map((prompt, i) => (
              <button 
                key={i} 
                onClick={() => {
                  handleSend(prompt);
                  if (prompt === 'Plan Kyoto Trip') onQuickSelectAI();
                }}
                style={{ 
                  fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid var(--border-glass)', color: '#a5b4fc', 
                  padding: '0.25rem 0.6rem', borderRadius: '999px', whiteSpace: 'nowrap', cursor: 'pointer'
                }}
              >
                + {prompt}
              </button>
            ))}
          </div>

          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              placeholder="Ask anything..." 
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'white', fontSize: '0.85rem', outline: 'none' }}
            />
            <button 
              onClick={() => handleSend()} 
              style={{ background: 'var(--accent-teal)', border: 'none', borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'white', cursor: 'pointer' }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
