const STORAGE_KEY = 'velora.userId';
const TOKEN_KEY = 'velora.token';

/**
 * Returns a stable per-browser GUEST identity.
 *
 * You can browse and generate an itinerary without an account, and this is the
 * id those trips belong to. It is client-controlled and trivially spoofed, which
 * is fine precisely because it can only ever reach anonymous data: the backend
 * only accepts header identities matching `guest_<alphanumerics>`, so this can
 * never be edited into someone's account id.
 *
 * Signed-in users are identified by a JWT instead — see getToken() below.
 */
export function getUserId() {
  let userId = null;

  try {
    userId = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing / storage disabled — fall through to an ephemeral id.
  }

  if (!userId) {
    const random =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

    // Charset AND prefix must satisfy the backend's GUEST_ID_PATTERN:
    // /^guest_[A-Za-z0-9]{8,56}$/. The `guest_` prefix is not cosmetic — it is
    // what keeps guest ids in a separate namespace from account ids.
    userId = `guest_${random.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 62);

    try {
      window.localStorage.setItem(STORAGE_KEY, userId);
    } catch {
      // Non-persistent identity for this session only.
    }
  }

  return userId;
}

// ---------------------------------------------------------------------- token

/**
 * The JWT, if signed in.
 *
 * Stored in localStorage. The honest tradeoff: any script that runs on this
 * page can read it, so an XSS bug becomes account takeover. The more secure
 * alternative is an httpOnly cookie the JavaScript cannot touch, which needs a
 * refresh-token flow to go with it. See INTERVIEW_PREP.md.
 */
export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable — the session lasts until reload.
  }
}

/**
 * Headers for every request.
 *
 * Both are sent. The backend prefers the token and ignores the guest header
 * whenever one is present, so there's no ambiguity about who you are — but
 * keeping the guest id attached means signing out drops you straight back to
 * your guest session instead of a broken, identity-less state.
 */
export function identityHeaders() {
  const token = getToken();
  return {
    'x-user-id': getUserId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
