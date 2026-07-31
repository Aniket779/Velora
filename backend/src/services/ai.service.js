'use strict';

const { Queue, Job } = require('bullmq');
const {
  redisConnection,
  QUEUE_NAMES,
  JOB_NAMES,
  attachRedisErrorLogging,
} = require('../config/redis');
const { isValidUserId } = require('../constants/socketEvents');
const {
  BUDGET_TIERS,
  TRAVELLER_TYPES,
  ADVENTURE_LEVELS,
  PACE_OPTIONS,
  INTERESTS,
  FOOD_PREFERENCES,
  GROUP_SIZE_BY_TYPE,
} = require('../constants/travelProfile');
const AppError = require('../utils/AppError');

const MIN_DAYS = 1;
const MAX_DAYS = 14;

const pickEnum = (value, allowed, fallback) =>
  typeof value === 'string' && allowed.includes(value.trim()) ? value.trim() : fallback;

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Put the request in the queue and walk away"
 * ============================================================================
 * When a user clicks Generate, we do NOT make them wait 30 seconds for the
 * AI. Instead:
 *
 *   1. buildProfile()   - clean up and validate what the user sent
 *   2. queue.add()      - drop the job into Redis via BullMQ
 *   3. return jobId     - the API responds 202 Accepted immediately
 *
 * The worker picks it up separately. The user gets the result over WebSocket.
 *
 * getGenerationStatus() is the backup plan: if the WebSocket is broken, the
 * browser can poll this endpoint with the jobId instead.
 * ============================================================================
 */
const normalisePlace = (value = '') =>
  value.toString().trim().split(',')[0].trim().replace(/\s+/g, ' ');

const pickEnumArray = (value, allowed, fallback = []) => {
  if (!Array.isArray(value)) return fallback;
  const filtered = [...new Set(value.filter((v) => typeof v === 'string' && allowed.includes(v)))];
  return filtered.length ? filtered : fallback;
};

class AIService {
  constructor() {
    this.queue = attachRedisErrorLogging(
      new Queue(QUEUE_NAMES.AI_GENERATION, { connection: redisConnection }),
      'AIService:Queue'
    );
  }

  /**
   * Normalises the raw request body into a complete traveller profile.
   *
   * Every dimension the itinerary adapts to is resolved to a known enum value here,
   * so the prompt builder and the catalogue filter both receive a fully-populated,
   * trustworthy object. Unknown values fall back rather than erroring — a client
   * sending an interest we do not recognise should still get a plan.
   */
  static buildProfile(body = {}) {
    const rawDestination = typeof body.destination === 'string' ? body.destination.trim() : '';
    const destination = normalisePlace(rawDestination);
    if (!destination) {
      throw new AppError('A destination is required to generate an itinerary.', 400);
    }

    const days = Number(body.days);
    if (!Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) {
      throw new AppError(
        `Trip duration must be a whole number between ${MIN_DAYS} and ${MAX_DAYS} days.`,
        400
      );
    }

    const travellerType = pickEnum(body.travellerType, TRAVELLER_TYPES, 'couple');

    const rawGroupSize = Number(body.groupSize);
    const groupSize =
      Number.isInteger(rawGroupSize) && rawGroupSize >= 1 && rawGroupSize <= 30
        ? rawGroupSize
        : GROUP_SIZE_BY_TYPE[travellerType];

    return {
      destination,
      /** Full label as the user selected it, for display only. */
      destinationLabel: rawDestination || destination,
      origin: normalisePlace(body.origin) || 'Delhi',
      days,
      budget: pickEnum(body.budget, BUDGET_TIERS, 'moderate'),
      travellerType,
      groupSize,
      adventureLevel: pickEnum(body.adventureLevel, ADVENTURE_LEVELS, 'moderate'),
      pace: pickEnum(body.pace, PACE_OPTIONS, 'balanced'),
      interests: pickEnumArray(body.interests, INTERESTS, ['culture', 'food']),
      foodPreferences: pickEnumArray(body.foodPreferences, FOOD_PREFERENCES, ['no-restrictions']),
      travelMonth: typeof body.travelMonth === 'string' ? body.travelMonth.trim() : '',
      notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '',
    };
  }

  async requestItineraryGeneration(userId, tripId, body) {
    if (!isValidUserId(userId)) {
      throw new AppError('A valid user identity is required to generate an itinerary.', 400);
    }

    const profile = AIService.buildProfile(body);

    const job = await this.queue.add(JOB_NAMES.GENERATE_ITINERARY, {
      userId,
      tripId,
      profile,
      requestedAt: new Date().toISOString(),
    });

    console.log(
      `[AIService] Enqueued job ${job.id} for ${userId} — ${profile.destination} ${profile.days}d ` +
        `${profile.travellerType}/${profile.budget}/${profile.adventureLevel} ` +
        `interests=[${profile.interests.join(',')}] food=[${profile.foodPreferences.join(',')}]`
    );

    return {
      jobId: job.id,
      status: 'processing',
      profile,
      message: 'Itinerary generation started in the background.',
    };
  }

  async getGenerationStatus(jobId, userId) {
    if (!isValidUserId(userId)) {
      throw new AppError('A valid user identity is required.', 400);
    }

    const job = await Job.fromId(this.queue, jobId);
    if (!job || job.data?.userId !== userId) {
      throw new AppError('Generation job not found or has expired.', 404);
    }

    const state = await job.getState();
    const response = { jobId: job.id, state, progress: job.progress || 0 };

    if (state === 'completed') {
      response.itinerary = job.returnvalue?.itinerary ?? null;
      if (!response.itinerary) {
        response.state = 'failed';
        response.error = 'Generation finished but produced no itinerary.';
      }
    } else if (state === 'failed') {
      response.error = job.failedReason || 'Itinerary generation failed.';
    }

    return response;
  }

  async close() {
    await this.queue.close();
  }
}

module.exports = new AIService();
module.exports.buildProfile = AIService.buildProfile;
