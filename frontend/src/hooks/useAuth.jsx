import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { auth as authApi, AUTH_REQUIRED_EVENT } from '../api/client';
import { getToken, setToken } from '../utils/identity';

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Who is signed in, app-wide"
 * ============================================================================
 * One provider holds the user. Any component can read it with useAuth().
 *
 * THE PART THAT ISN'T OBVIOUS: a token in localStorage is not proof of
 * anything. It could be expired, or belong to a deleted account, or have been
 * signed by a server whose secret has since been rotated. So on mount we don't
 * trust it — we call /me, and only a successful response makes someone signed
 * in. That round trip is why `loading` exists, and why UI that depends on auth
 * must wait for it rather than flashing a signed-out state first.
 * ============================================================================
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set when something needs auth — the modal reads this to open itself.
  const [authPrompt, setAuthPrompt] = useState(null);

  // Restore the session on load by validating the stored token server-side.
  useEffect(() => {
    let cancelled = false;

    if (!getToken()) {
      setLoading(false);
      return undefined;
    }

    authApi
      .me()
      .then(({ user: me }) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        // Expired, tampered, or the account is gone. Drop it and continue as a
        // guest rather than leaving a dead token to fail every later request.
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 from anywhere in the app lands here.
  useEffect(() => {
    const onAuthRequired = (e) => {
      setUser((current) => {
        // Only clear if we believed we were signed in — a 401 on a guest
        // action just means "please sign in", not "your session died".
        if (current) setToken(null);
        return null;
      });
      setAuthPrompt({ mode: 'login', message: e.detail?.message || 'Please sign in to continue.' });
    };

    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: me, token } = await authApi.login({ email, password });
    setToken(token);
    setUser(me);
    setAuthPrompt(null);
    return me;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { user: me, token } = await authApi.register({ name, email, password });
    setToken(token);
    setUser(me);
    setAuthPrompt(null);
    return me;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    // Library data belongs to the account that just left. Reloading is the
    // simplest correct way to clear every cache at once — subtler approaches
    // reliably leave one stale list showing the previous user's trips.
    window.location.assign('/');
  }, []);

  /**
   * Wrap any action that needs an account:
   *   onClick={() => requireAuth(() => save(trip))}
   * Signed in, it runs. Signed out, it opens the modal instead of firing a
   * request that would only come back 401.
   */
  const requireAuth = useCallback(
    (action, message = 'Sign in to save this.') => {
      if (user) return action();
      setAuthPrompt({ mode: 'login', message });
      return undefined;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      requireAuth,
      authPrompt,
      openAuth: (mode = 'login', message = '') => setAuthPrompt({ mode, message }),
      closeAuth: () => setAuthPrompt(null),
    }),
    [user, loading, login, register, logout, requireAuth, authPrompt]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
