'use strict';

const {
  SOCKET_EVENTS,
  isGuestId,
  userRoom,
  tripRoom,
} = require('../constants/socketEvents');
const { verifyToken } = require('../utils/jwt');

/**
 * ============================================================================
 * Socket.io wiring — and the room isolation that makes it safe
 * ============================================================================
 * Every client joins `user_<id>` and finished itineraries are emitted to that
 * room. So whoever controls the id controls whose results you receive.
 *
 * This handshake mirrors the HTTP middleware exactly, and it has to: an
 * attacker who could not forge an identity over HTTP but could forge one here
 * would simply sit in your room and collect your itineraries as they generate.
 *
 *   token present and valid  ->  account id, from the verified `sub` claim
 *   no token, guest_ id      ->  that guest id
 *   anything else            ->  handshake rejected
 *
 * The account id is never taken from the handshake payload, only ever from a
 * signature we checked. That is what stops one user joining another's room.
 * ============================================================================
 */
const initializeSocket = (io) => {
  io.use((socket, next) => {
    const { token, userId } = socket.handshake.auth || {};

    const claims = verifyToken(token);
    if (claims) {
      socket.userId = claims.userId;
      socket.isAuthenticated = true;
      return next();
    }

    // No valid token — fall back to a guest identity. The guest namespace is
    // what prevents this branch being used to claim an account's room, since a
    // 24-character ObjectId can never match `guest_...`.
    const candidate = typeof userId === 'string' ? userId.trim() : '';
    if (!isGuestId(candidate)) {
      return next(new Error('Authentication error: sign in, or supply a valid guest id'));
    }

    socket.userId = candidate;
    socket.isAuthenticated = false;
    next();
  });

  io.on('connection', (socket) => {
    const room = userRoom(socket.userId);

    // Join the per-user room before acknowledging, so the client is guaranteed to
    // be in the room by the time it learns it is connected. Acknowledging first
    // would open a window where the client believes it can receive events but the
    // room membership has not yet been established.
    socket.join(room);

    console.log(
      `[Socket] Client ${socket.id} connected as ${socket.userId} and joined ${room}`
    );

    // Explicit readiness signal. The client uses this to decide whether it can rely
    // on push delivery or should lean on the polling fallback.
    socket.emit(SOCKET_EVENTS.ROOM_JOINED, { userId: socket.userId, room });

    // --- Collaboration handlers -------------------------------------------------
    // Reserved for roadmap M17. No client currently emits these; they are kept
    // deliberately (rather than deleted as dead code) because the collaboration
    // milestone builds directly on them.
    socket.on(SOCKET_EVENTS.JOIN_TRIP, (tripId) => {
      if (typeof tripId !== 'string' || !tripId.trim()) return;
      const room = tripRoom(tripId.trim());
      socket.join(room);
      socket.to(room).emit(SOCKET_EVENTS.USER_JOINED, { userId: socket.userId });
    });

    socket.on(SOCKET_EVENTS.UPDATE_ITINERARY, ({ tripId, data } = {}) => {
      if (typeof tripId !== 'string' || !tripId.trim()) return;
      socket.to(tripRoom(tripId.trim())).emit(SOCKET_EVENTS.ITINERARY_UPDATED, data);
    });
    // ---------------------------------------------------------------------------

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client ${socket.id} (${socket.userId}) disconnected: ${reason}`);
    });
  });
};

module.exports = { initializeSocket };
