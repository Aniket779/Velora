import React, { useState, useRef, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Sparkles, X, Send, Loader2, Database } from 'lucide-react';
import { discover } from '../api/client';

/**
 * ============================================================================
 * AI TRAVEL ASSISTANT
 * ============================================================================
 * This used to be a setTimeout that echoed your message back with
 * "Got it! I am tailoring options for X". It called nothing and knew nothing.
 *
 * It now posts to /discover/assistant/chat, which retrieves the user's own
 * trips and favourites plus real inventory for whatever city was mentioned,
 * and answers from that data. The "grounded" badge appears when the reply was
 * backed by database records.
 *
 * Replies can carry suggestions — "Plan a trip to Goa", "See Goa guide" —
 * which navigate rather than just talk.
 * ============================================================================
 */
export default function FloatingAIAssistant({ onQuickSelectAI, citySlug }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "Hi — I'm Velora's assistant. Ask me about a destination, or about your own saved trips and bookings. I answer from our database, so I won't invent places.",
    },
  ]);

  const navigate = useNavigate();
  const logRef = useRef(null);
  const titleId = useId();

  // Keep the newest message in view.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (textToSend) => {
    const text = (textToSend ?? input).trim();
    if (!text || sending) return;

    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text }]);
    setSending(true);

    try {
      const res = await discover.chat({
        message: text,
        // Recent turns give the model conversational context.
        history: messages.slice(-6),
        citySlug,
      });

      setMessages((prev) => [...prev, {
        sender: 'bot',
        text: res.reply,
        grounded: res.grounded,
        isMock: res.isMock,
        suggestions: res.suggestions || [],
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        sender: 'bot',
        isError: true,
        text: err?.response?.data?.message ||
          "I couldn't reach the assistant service. Check the backend is running.",
      }]);
    } finally {
      setSending(false);
    }
  };

  const runSuggestion = (s) => {
    if (s.action === 'destination') navigate(`/destination/${s.citySlug}`);
    else if (s.action === 'plan') { setIsOpen(false); onQuickSelectAI?.(); }
  };

  const QUICK = ['What can I do in Goa?', 'Show my saved trips', 'Where should I eat in Jaipur?'];

  return (
    <>
      <button
        className="floating-bot-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close travel assistant' : 'Open travel assistant'}
      >
        <Bot size={20} aria-hidden="true" />
        <span className="bot-label">Ask Velora</span>
        <Sparkles size={15} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="bot-modal-container glass-panel" role="dialog" aria-labelledby={titleId}>
          <div style={{
            background: 'var(--accent-gradient-teal)', padding: '0.9rem 1rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white',
          }}>
            <div id={titleId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Bot size={18} aria-hidden="true" /> Velora Assistant
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation"
            style={{ padding: '1rem', height: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}
          >
            {messages.map((m, idx) => (
              <div key={idx} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  background: m.sender === 'user'
                    ? 'var(--accent-primary)'
                    : m.isError ? 'var(--danger-soft)' : 'rgba(255,255,255,0.07)',
                  border: m.isError ? '1px solid rgba(251,113,133,0.3)' : 'none',
                  color: m.isError ? '#fda4af' : 'white',
                }}>
                  {m.text}
                </div>

                {/* Shows when the answer came from real records. */}
                {m.grounded && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--success)', marginTop: 4 }}>
                    <Database size={9} aria-hidden="true" /> answered from database records
                  </div>
                )}

                {m.suggestions?.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {m.suggestions.map((s, i) => (
                      <button key={i} className="chip" onClick={() => runSuggestion(s)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <Loader2 size={13} className="spin" aria-hidden="true" /> Searching the database…
              </div>
            )}
          </div>

          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border-glass-light)', display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
            {QUICK.map((q) => (
              <button
                key={q}
                className="chip"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => send(q)}
                disabled={sending}
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            style={{ padding: '0.75rem', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '0.5rem' }}
          >
            <input
              type="text"
              placeholder="Ask about a destination…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              maxLength={500}
              aria-label="Message the assistant"
              style={{
                flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-xs)', padding: '0.55rem 0.75rem', color: 'white',
                fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              style={{
                background: 'var(--accent-teal)', border: 'none', borderRadius: 'var(--radius-xs)',
                padding: '0.55rem 0.75rem', color: 'white', cursor: 'pointer',
                opacity: sending || !input.trim() ? 0.5 : 1,
              }}
            >
              <Send size={15} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
