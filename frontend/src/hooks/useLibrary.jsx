import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { library } from '../api/client';
import { useAuth } from './useAuth';

/**
 * ============================================================================
 * LIBRARY CONTEXT — the connective tissue
 * ============================================================================
 * Favourite state has to be available EVERYWHERE — every hotel card, every
 * restaurant card, in search results and inside a generated itinerary. Fetching
 * it per component would mean dozens of duplicate requests and hearts that
 * disagree with each other.
 *
 * So it's fetched once into a Set of "refType:refId" keys. Any card can ask
 * `isFavorite('hotel', id)` in O(1), and toggling updates every card at once.
 *
 * Toggles are OPTIMISTIC — the heart fills instantly and rolls back if the
 * request fails. A favourite that takes 300ms to respond feels broken.
 * ============================================================================
 */

const LibraryContext = createContext(null);

const EMPTY_OVERVIEW = { trips: 0, saved: 0, favorites: 0, bookings: 0, recentlyViewed: 0 };

export function LibraryProvider({ children }) {
  const { isAuthenticated, loading: authLoading, requireAuth } = useAuth();

  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    // The library is account-scoped. Fetching it as a guest is a guaranteed
    // 401, so don't ask — this is the difference between "signed out" and
    // "signed out AND spamming the console with failed requests".
    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      setOverview(EMPTY_OVERVIEW);
      setReady(true);
      return;
    }

    try {
      const [ids, ov] = await Promise.all([
        library.favoriteIds(),
        library.overview(),
      ]);
      setFavoriteIds(new Set(ids.ids || []));
      setOverview(ov);
    } catch {
      // The library is an enhancement — if it fails, the app still works.
    } finally {
      setReady(true);
    }
  }, [isAuthenticated]);

  // Waits for auth to resolve first. Firing during `authLoading` would fetch
  // as a guest and then immediately refetch — and briefly show an empty
  // library to someone who is in fact signed in.
  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  const isFavorite = useCallback(
    (refType, refId) => favoriteIds.has(`${refType}:${refId}`),
    [favoriteIds]
  );

  const toggleFavorite = useCallback(async (refType, refId) => {
    // Signed out? Open the sign-in prompt instead of firing a request that
    // could only ever come back 401. The heart never flickers on and off.
    if (!isAuthenticated) {
      requireAuth(() => {}, 'Sign in to save your favourites.');
      return;
    }

    const key = `${refType}:${refId}`;
    const wasFav = favoriteIds.has(key);

    // Optimistic flip.
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(key); else next.add(key);
      return next;
    });
    setOverview((o) => ({ ...o, favorites: o.favorites + (wasFav ? -1 : 1) }));

    try {
      await library.toggleFavorite(refType, String(refId));
    } catch {
      // Roll back — the heart must reflect what the server actually stored.
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(key); else next.delete(key);
        return next;
      });
      setOverview((o) => ({ ...o, favorites: o.favorites + (wasFav ? 1 : -1) }));
    }
  }, [favoriteIds, isAuthenticated, requireAuth]);

  /** Fire-and-forget: recording a view must never block navigation. */
  const recordView = useCallback((citySlug) => {
    // Nothing to attribute a view to when signed out, and no prompt either —
    // browsing is not an action that should ask anyone to sign in.
    if (!citySlug || !isAuthenticated) return;
    library.recordView(citySlug).catch(() => {});
  }, [isAuthenticated]);

  return (
    <LibraryContext.Provider
      value={{
        favoriteIds, isFavorite, toggleFavorite, overview, refresh, recordView, ready,
        isAuthenticated,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}
