const { Queue } = require('bullmq');
const AppError = require('../utils/AppError');

// Initialize BullMQ connection
const aiQueue = new Queue('ai-generation-queue', {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  },
});

class AIService {
  /**
   * Pushes the generation request to the background queue.
   * Returns immediately so the HTTP request doesn't block.
   */
  async requestItineraryGeneration(userId, tripId, promptData) {
    if (!promptData.destination || !promptData.days) {
      throw new AppError('Destination and days are required for generation.', 400);
    }

    // Add job to BullMQ
    const job = await aiQueue.add('generate-itinerary', {
      userId,
      tripId,
      promptData,
    });

    return {
      message: 'Itinerary generation started in the background.',
      jobId: job.id,
      status: 'processing'
    };
  }
}

module.exports = new AIService();
