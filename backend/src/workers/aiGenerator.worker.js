const { Worker } = require('bullmq');
const aiIntegrator = require('../integrators/ai.integrator');
const tripRepository = require('../repositories/trip.repository');

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

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
      // In a real scenario, you'd iterate over `generatedItinerary.days` and save to the ItineraryItems collection
      
      // 3. (Future) Trigger Socket.io event to notify the specific user
      console.log(`[Worker] Successfully completed job ${job.id}`);
      return { success: true, userId, itinerary: generatedItinerary };

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
