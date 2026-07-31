/**
 * Runtime configuration.
 *
 * The API base URL was previously a hardcoded 'http://localhost:5000' string literal
 * repeated in 12 places, which made a production build impossible. This milestone
 * introduces the constant so the new endpoints do not add more copies; the full API
 * client module is roadmap M5.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000';

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;

/** How long to wait for a generation result before surfacing a timeout to the user. */
export const AI_GENERATION_TIMEOUT_MS = 90_000;

/** Polling cadence for the socket fallback. */
export const AI_POLL_INTERVAL_MS = 5_000;
