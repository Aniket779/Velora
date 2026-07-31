/**
 * Mirror of backend/src/constants/socketEvents.js.
 * These two files must stay in sync until there is a shared package (roadmap M5).
 */
export const SOCKET_EVENTS = Object.freeze({
  ITINERARY_GENERATED: 'itinerary_generated',
  ITINERARY_GENERATION_FAILED: 'itinerary_generation_failed',
  ROOM_JOINED: 'room_joined',
});
