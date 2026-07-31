import axios from 'axios';
import { API_BASE_URL } from '../config';
import { identityHeaders } from '../utils/identity';

/**
 * ============================================================================
 * API CLIENT
 * ============================================================================
 * One axios instance with the identity header attached automatically, plus
 * named endpoint functions so components never build URLs by hand.
 *
 * This replaces scattered `axios.get('http://localhost:5000/...')` calls —
 * with 15 new features that pattern would have meant dozens of hardcoded URLs
 * and an identity header everyone had to remember to add.
 * ============================================================================
 */

const api = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

api.interceptors.request.use((config) => {
  config.headers = { ...config.headers, ...identityHeaders() };
  return config;
});

/**
 * Turns an EXPIRED SESSION into a single app-wide event.
 *
 * The condition is deliberately narrow: a 401 only raises this if the request
 * actually carried a token. That distinction matters —
 *
 *   token sent, 401 back  ->  the session died. Tell the user, clear it.
 *   no token, 401 back    ->  a guest touched an account-only endpoint. Normal.
 *
 * Without the check, the sign-in modal would fly open the moment any guest
 * loaded the page, because LibraryProvider fetches favourites on mount and
 * that endpoint requires an account.
 */
export const AUTH_REQUIRED_EVENT = 'velora:auth-required';

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.Authorization);

    if (error.response?.status === 401 && sentToken) {
      window.dispatchEvent(
        new CustomEvent(AUTH_REQUIRED_EVENT, {
          detail: { message: 'Your session has expired. Please sign in again.' },
        })
      );
    }
    return Promise.reject(error);
  }
);

/** Unwraps `{ success, data }` so callers work with the payload directly. */
const unwrap = (res) => res.data?.data ?? res.data;

export const auth = {
  register: (payload) => api.post('/api/v1/auth/register', payload).then(unwrap),
  login: (payload) => api.post('/api/v1/auth/login', payload).then(unwrap),
  me: () => api.get('/api/v1/auth/me').then(unwrap),
  updatePreferences: (preferences) =>
    api.patch('/api/v1/auth/preferences', preferences).then(unwrap),
};

export const catalog = {
  flights: (params) => api.get('/api/v1/services/flights', { params }).then(unwrap),
  hotels: (params) => api.get('/api/v1/services/hotels', { params }).then(unwrap),
  cabs: (params) => api.get('/api/v1/services/cabs', { params }).then(unwrap),
  destinations: (params) => api.get('/api/destinations', { params }).then((r) => r.data?.data ?? []),
};

export const trips = {
  generate: (payload) => api.post('/api/v1/trips/generate', payload).then(unwrap),
  status: (jobId) => api.get(`/api/v1/trips/generate/${jobId}`).then(unwrap),
};

export const library = {
  overview: () => api.get('/api/v1/library/overview').then(unwrap),

  list: (params) => api.get('/api/v1/library/trips', { params }).then(unwrap),
  get: (id) => api.get(`/api/v1/library/trips/${id}`).then(unwrap),
  save: (id, isSaved) => api.patch(`/api/v1/library/trips/${id}/save`, { isSaved }).then(unwrap),
  rename: (id, title) => api.patch(`/api/v1/library/trips/${id}/title`, { title }).then(unwrap),
  remove: (id) => api.delete(`/api/v1/library/trips/${id}`).then(unwrap),

  share: (id) => api.post(`/api/v1/library/trips/${id}/share`).then(unwrap),
  unshare: (id) => api.delete(`/api/v1/library/trips/${id}/share`).then(unwrap),
  shared: (token) => api.get(`/api/v1/library/shared/${token}`).then(unwrap),

  favorites: (refType) => api.get('/api/v1/library/favorites', { params: { refType } }).then(unwrap),
  favoriteIds: () => api.get('/api/v1/library/favorites/ids').then(unwrap),
  toggleFavorite: (refType, refId) =>
    api.post('/api/v1/library/favorites/toggle', { refType, refId }).then(unwrap),

  recentlyViewed: () => api.get('/api/v1/library/recently-viewed').then(unwrap),
  recordView: (citySlug) => api.post('/api/v1/library/recently-viewed', { citySlug }).then(unwrap),

  bookings: (status) => api.get('/api/v1/library/bookings', { params: { status } }).then(unwrap),
  book: (payload) => api.post('/api/v1/library/bookings', payload).then(unwrap),
  cancelBooking: (id) => api.patch(`/api/v1/library/bookings/${id}/cancel`).then(unwrap),
};

export const discover = {
  nearby: (params) => api.get('/api/v1/discover/nearby', { params }).then(unwrap),
  weather: (citySlug, month) =>
    api.get(`/api/v1/discover/weather/${citySlug}`, { params: { month } }).then(unwrap),
  budget: (citySlug, params) =>
    api.get(`/api/v1/discover/budget/${citySlug}`, { params }).then(unwrap),

  checklist: (itineraryId) => api.get(`/api/v1/discover/checklist/${itineraryId}`).then(unwrap),
  addChecklistItem: (itineraryId, label) =>
    api.post(`/api/v1/discover/checklist/${itineraryId}`, { label }).then(unwrap),
  toggleChecklistItem: (itineraryId, itemId, done) =>
    api.patch(`/api/v1/discover/checklist/${itineraryId}/${itemId}`, { done }).then(unwrap),

  recommendations: (limit) =>
    api.get('/api/v1/discover/recommendations', { params: { limit } }).then(unwrap),

  chat: (payload) => api.post('/api/v1/discover/assistant/chat', payload).then(unwrap),
};

export { api };
