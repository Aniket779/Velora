'use strict';

/**
 * Socket.io event names shared by the socket layer and the queue listener.
 *
 * These strings are part of the contract with the browser. The frontend mirrors this
 * file at frontend/src/constants/socketEvents.js — the two must stay in sync until
 * there is a shared package to hold them (see roadmap M5).
 */

const SOCKET_EVENTS = Object.freeze({
  // Server -> client
  ITINERARY_GENERATED: 'itinerary_generated',
  ITINERARY_GENERATION_FAILED: 'itinerary_generation_failed',
  ITINERARY_GENERATION_PROGRESS: 'itinerary_generation_progress',
  ROOM_JOINED: 'room_joined',
  USER_JOINED: 'user_joined',
  ITINERARY_UPDATED: 'itinerary_updated',

  // Client -> server
  JOIN_TRIP: 'join_trip',
  UPDATE_ITINERARY: 'update_itinerary',
});

/**
 * Identity values flow into Socket.io room names (`user_<id>`). Constraining the
 * charset keeps room names predictable and prevents a caller from smuggling
 * separators or whitespace into a room key.
 */
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;

const isValidUserId = (value) =>
  typeof value === 'string' && USER_ID_PATTERN.test(value.trim());

/**
 * Guest ids are NAMESPACED, and that namespace is load-bearing security.
 *
 * Guests are still identified by a client-supplied header, because you can
 * browse and generate without an account. That header is trivially forged — so
 * if a real account's id looked like a valid header value, anyone could send
 * `x-user-id: <someone's ObjectId>` and read their trips and bookings.
 *
 * The `guest_` prefix makes the two id spaces disjoint:
 *   - a header is only ever trusted if it matches GUEST_ID_PATTERN
 *   - an account id (a 24-char Mongo ObjectId) can ONLY come from a verified JWT
 *
 * A forged `x-user-id` can therefore only ever impersonate another guest, whose
 * data is anonymous by definition.
 */
const GUEST_ID_PATTERN = /^guest_[A-Za-z0-9]{8,56}$/;

const isGuestId = (value) =>
  typeof value === 'string' && GUEST_ID_PATTERN.test(value.trim());

const userRoom = (userId) => `user_${userId}`;
const tripRoom = (tripId) => `trip_${tripId}`;

module.exports = {
  SOCKET_EVENTS,
  USER_ID_PATTERN,
  GUEST_ID_PATTERN,
  isValidUserId,
  isGuestId,
  userRoom,
  tripRoom,
};
