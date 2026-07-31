import React from 'react';
import { AlertTriangle, RefreshCw, SearchX, WifiOff } from 'lucide-react';

/**
 * ============================================================================
 * SHARED UI STATES
 * ============================================================================
 * Empty, error, loading and crash states in one place.
 *
 * WHY THIS FILE EXISTS
 * Every list used to render its own empty state with slightly different
 * wording ("No flights available for this route." / "No hotels available for
 * this destination." / "No locations to display on map."), and a failed fetch
 * looked identical to a genuinely empty result — the user saw
 * "Available Flights (0)" whether the server was down or the search simply had
 * no matches. Those are very different situations and now look different.
 * ============================================================================
 */

/* -------------------------------------------------------------------------
 * Error boundary — stops one broken component blanking the whole page
 * ---------------------------------------------------------------------- */

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production this is where Sentry would go.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="glass-panel state-panel" role="alert">
        <div className="state-icon state-icon--error">
          <AlertTriangle size={26} color="var(--danger)" />
        </div>
        <h3 className="state-title">Something broke on this screen</h3>
        <p className="state-body">
          {this.props.message || 'This section failed to render. The rest of the app still works.'}
        </p>
        <button className="btn-primary" onClick={() => this.setState({ error: null })}>
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    );
  }
}

/* -------------------------------------------------------------------------
 * Empty vs error — deliberately distinct
 * ---------------------------------------------------------------------- */

export function EmptyState({ title, message, icon: Icon = SearchX, action }) {
  return (
    <div className="glass-panel state-panel">
      <div className="state-icon state-icon--neutral">
        <Icon size={26} color="var(--accent-primary)" />
      </div>
      <h3 className="state-title">{title}</h3>
      {message && <p className="state-body">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "We couldn't load this", message, onRetry, retrying }) {
  return (
    <div className="glass-panel state-panel" role="alert">
      <div className="state-icon state-icon--error">
        <WifiOff size={26} color="var(--danger)" />
      </div>
      <h3 className="state-title">{title}</h3>
      <p className="state-body">
        {message || 'The server did not respond. Check that the backend is running and try again.'}
      </p>
      {onRetry && (
        <button className="btn-primary" onClick={onRetry} disabled={retrying}>
          <RefreshCw size={16} className={retrying ? 'spin' : undefined} />
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Skeletons
 * ---------------------------------------------------------------------- */

export function SkeletonCard() {
  return (
    <div className="listing-card glass-panel skeleton-card" aria-hidden="true">
      <div className="skeleton-pulse skeleton-img" />
      <div style={{ flex: 1 }}>
        <div className="skeleton-pulse skeleton-text skeleton-title" />
        <div className="skeleton-pulse skeleton-text skeleton-subtitle" />
        <div className="skeleton-pulse skeleton-text" style={{ width: '76%' }} />
        <div className="skeleton-pulse skeleton-text" style={{ width: '52%', marginBottom: 0 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' }}>
        <div className="skeleton-pulse skeleton-text" style={{ width: '84px', height: '1.6rem' }} />
        <div className="skeleton-pulse skeleton-button" />
      </div>
    </div>
  );
}

/**
 * `aria-busy` + a polite live region means a screen reader announces that
 * results are loading instead of silently showing nothing.
 */
export function SkeletonList({ count = 4, label = 'Loading results' }) {
  return (
    <div className="cards-grid" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
