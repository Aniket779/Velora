'use strict';

const { Worker } = require('bullmq');
const aiIntegrator = require('../ai/llm');
const tripRepository = require('../repositories/trip.repository');
const inventoryCatalog = require('../services/inventoryCatalog.service');
const destinationIntelligenceService = require('../services/destinationIntelligence.service');
const grounding = require('../services/itineraryGrounding.service');
const {
  redisConnection,
  QUEUE_NAMES,
  attachRedisErrorLogging,
} = require('../config/redis');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "The actual work happens here"
 * ============================================================================
 * Runs in the background, picks jobs off the Redis queue, and does the
 * 4 steps that make Velora's AI different from a plain ChatGPT wrapper:
 *
 *   STEP 1  Get real data from MongoDB (hotels/restaurants/places/flights)
 *           + get the cached city briefing        [both at the same time]
 *   STEP 2  Ask the AI for a plan, giving it that real data to choose from
 *   STEP 3  Verify every choice points at a real database record
 *   STEP 4  Save it, and return it so the user gets notified
 *
 * THE ORDER MATTERS. The old code did: generate first, fetch data after.
 * That's why the AI invented "Central Hotel Goa" - it had never seen our
 * actual hotels. Fetching FIRST is the whole fix.
 * ============================================================================
 */
const processGenerationJob = async (job) => {
  const { userId, tripId, profile } = job.data;
  const t0 = Date.now();

  console.log(
    `[Worker] Job ${job.id} — ${profile.destination} ${profile.days}d ` +
      `${profile.travellerType}/${profile.budget} for ${userId}`
  );

  // 1. Real inventory + cached destination knowledge, concurrently.
  await job.updateProgress(10);
  const [catalog, intelligenceRecord] = await Promise.all([
    inventoryCatalog.buildCatalog(profile.destination, profile.origin, profile),
    destinationIntelligenceService.get(profile.destination).catch((err) => {
      // A briefing failure must not sink the itinerary — the plan is the primary
      // deliverable and the briefing is enrichment.
      console.error(`[Worker] Job ${job.id} destination intelligence failed: ${err.message}`);
      return null;
    }),
  ]);

  console.log(
    `[Worker] Job ${job.id} catalogue: ${catalog.counts.hotels}H ${catalog.counts.restaurants}R ` +
      `${catalog.counts.places}P ${catalog.counts.flights}F (budget band: ${catalog.budgetBand.label})`
  );

  // 2. Generate the plan against the catalogue.
  await job.updateProgress(35);
  const catalogText = inventoryCatalog.renderForPrompt(catalog);
  const { data: rawItinerary, isMock, promptVersion } = await aiIntegrator.generateItinerary({
    profile,
    catalog,
    catalogText,
    intelligence: intelligenceRecord?.intelligence || null,
  });

  // 3. Resolve every reference back to a real document, and reject inventions.
  await job.updateProgress(70);
  const { itinerary: groundedItinerary, stats, usedDocs } = grounding.ground(rawItinerary, catalog);
  const quality = grounding.assertQuality(stats, catalog);

  console.log(
    `[Worker] Job ${job.id} grounding: ${stats.referencedActivities}/${stats.totalActivities} ` +
      `activities resolved to real inventory` +
      (quality.degraded ? ' (degraded: no inventory seeded for this destination)' : '')
  );

  // 4. Persist.
  await job.updateProgress(85);
  const payload = {
    // Ownership is what makes a generated plan appear in Trip History.
    // Without it the itinerary belonged to nobody and was unreachable.
    ownerId: userId,
    trip_title: groundedItinerary.trip_title,
    title: groundedItinerary.trip_title,
    summary: groundedItinerary.summary,
    destination: profile.destination,
    origin: profile.origin,
    profile,
    days: groundedItinerary.days,
    totalEstimatedCostInr: groundedItinerary.total_estimated_cost_inr,
    personalisationNotes: groundedItinerary.personalisation_notes,
    packingReminders: groundedItinerary.packing_reminders,
    destinationIntelligence: intelligenceRecord?.intelligence || null,
    intelligenceMeta: intelligenceRecord
      ? {
          isMock: intelligenceRecord.isMock,
          emergencyNumbersVerified: intelligenceRecord.emergencyNumbersVerified,
          generatedAt: intelligenceRecord.generatedAt,
        }
      : null,
    travelData: {
      destination: profile.destination,
      origin: profile.origin,
      destinationInfo: intelligenceRecord?.intelligence || null,
      // Only inventory the plan actually references, plus the full candidate set for
      // the browse tabs.
      hotels: catalog.hotels.map((h) => h.doc),
      restaurants: catalog.restaurants.map((r) => r.doc),
      places: catalog.places.map((p) => p.doc),
      flights: catalog.flights.map((f) => f.doc),
      selected: usedDocs,
    },
    generationMeta: {
      isMock,
      promptVersion: promptVersion || null,
      model: isMock ? null : aiIntegrator.model,
      groundingStats: stats,
      degraded: Boolean(quality.degraded),
      durationMs: Date.now() - t0,
    },
  };

  const savedItinerary = await tripRepository.saveAIGeneratedItinerary(tripId, payload);
  await job.updateProgress(100);

  console.log(`[Worker] Job ${job.id} completed in ${Date.now() - t0}ms — itinerary ${savedItinerary._id}`);

  return { success: true, userId, jobId: job.id, itinerary: savedItinerary };
};

const aiWorker = attachRedisErrorLogging(
  new Worker(QUEUE_NAMES.AI_GENERATION, processGenerationJob, {
    connection: redisConnection,
    concurrency: Number(process.env.AI_WORKER_CONCURRENCY) || 3,
  }),
  'Worker'
);

aiWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

module.exports = aiWorker;
module.exports.processGenerationJob = processGenerationJob;
