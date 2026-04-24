const initializeSocket = (io) => {
  // Middleware for basic authentication
  io.use((socket, next) => {
    // In production, verify the JWT from socket.handshake.auth.token
    const userId = socket.handshake.auth.userId || socket.handshake.query.userId;
    if (!userId) {
      return next(new Error('Authentication error: Missing userId'));
    }
    socket.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id} (User: ${socket.userId})`);

    // 1. Join user-specific room for global notifications (e.g., job completed)
    socket.join(`user_${socket.userId}`);
    console.log(`Socket ${socket.id} joined global room: user_${socket.userId}`);

    // 2. Join a specific trip room for collaboration (OT / CRDTs)
    socket.on('join_trip', (tripId) => {
      socket.join(`trip_${tripId}`);
      console.log(`User ${socket.userId} joined collaborative trip room: ${tripId}`);
      
      // Notify others in the room
      socket.to(`trip_${tripId}`).emit('user_joined', { userId: socket.userId });
    });

    // 3. Handle itinerary drag & drop updates
    socket.on('update_itinerary', ({ tripId, data }) => {
      // Broadcast to everyone else in the room
      socket.to(`trip_${tripId}`).emit('itinerary_updated', data);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = { initializeSocket };
