const { QueueEvents } = require('bullmq');

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

class QueueListenerService {
  constructor(io) {
    this.io = io;
    this.aiQueueEvents = new QueueEvents('ai-generation-queue', { connection: redisConnection });
    
    this.initializeListeners();
  }

  initializeListeners() {
    console.log('[QueueListener] Listening for BullMQ events globally...');

    // Triggered when any worker anywhere completes a job on this queue
    this.aiQueueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`[QueueListener] Job ${jobId} completed. Emitting to user.`);
      
      // In a robust setup, you might fetch the job state from Redis to get the userId,
      // but if the worker returns it in `returnvalue`, you can use it directly.
      // Assuming returnvalue = { success: true, userId, itinerary }
      
      const { success, userId, itinerary } = returnvalue;
      
      if (userId && success) {
        this.io.to(`user_${userId}`).emit('itinerary_generated', { jobId, itinerary });
        console.log(`[QueueListener] Successfully pushed WebSocket event to user_${userId} for Job ${jobId}`);
      }
    });

    this.aiQueueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[QueueListener] Job ${jobId} failed: ${failedReason}`);
      // Notify the user of failure
      // this.io.to(`user_${userId}`).emit('itinerary_generation_failed', { error: failedReason });
    });
  }
}

module.exports = QueueListenerService;
