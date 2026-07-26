const { Worker } = require('bullmq');
const aiIntegrator = require('../integrators/ai.integrator');
const tripRepository = require('../repositories/trip.repository');

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

if (process.env.REDIS_PASSWORD) {
  redisConnection.password = process.env.REDIS_PASSWORD;
  redisConnection.tls = {}; // Required for Upstash
}

// This worker listens to the 'ai-generation-queue'
const aiWorker = new Worker(
  'ai-generation-queue',
  async (job) => {
    const { userId, tripId, promptData } = job.data;
    console.log(`[Worker] Starting itinerary generation for job ${job.id} (Trip: ${tripId})`);

    try {
      // 1. Call the AI Integrator (with retries and validation)
      const generatedItinerary = await aiIntegrator.generateItinerary(promptData);

      // 2. Format the response and update the database via the Repository
      console.log(`[Worker] Generated JSON for trip ${tripId}. Saving to DB...`);
      const savedItinerary = await tripRepository.saveAIGeneratedItinerary(tripId, generatedItinerary);
      
      // 3. Trigger Socket.io event to notify the specific user
      console.log(`[Worker] Successfully completed job ${job.id}`);
      
      // Return the saved document so the frontend can render it with actual DB IDs
      return { success: true, userId, itinerary: savedItinerary };

    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed:`, error.message);
      throw error; // Let BullMQ handle retries or move to Dead Letter Queue
    }
  },
  { connection: redisConnection }
);

aiWorker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});

aiWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = aiWorker;
