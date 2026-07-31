'use strict';

const { Queue, QueueEvents, Job } = require('bullmq');
const {
  redisConnection,
  QUEUE_NAMES,
  attachRedisErrorLogging,
} = require('../config/redis');
const { SOCKET_EVENTS, isValidUserId, userRoom } = require('../constants/socketEvents');

/**
 * ============================================================================
 * WHAT THIS FILE DOES  —  "Tell the browser when the job is done"
 * ============================================================================
 * The bridge between BullMQ (background jobs) and Socket.io (live updates).
 *
 *   Worker finishes  ->  BullMQ fires 'completed'  ->  this file
 *      ->  socket.io sends 'itinerary_generated' to that ONE user's room
 *
 * TWO THINGS TO KNOW:
 *
 * 1. The 'failed' event from BullMQ does NOT include the user id. So we look
 *    the job up by id and read job.data.userId. Without this, a failed
 *    generation could never be reported and the user would wait forever.
 *
 * 2. Every user has their own socket room called `user_<id>`. That's how a
 *    result reaches only the person who asked for it.
 * ============================================================================
 */
class QueueListenerService {
  constructor(io) {
    if (!io) {
      throw new Error('QueueListenerService requires a Socket.io server instance');
    }

    this.io = io;

    // A Queue handle is needed (not just QueueEvents) so jobs can be loaded by id.
    this.queue = attachRedisErrorLogging(
      new Queue(QUEUE_NAMES.AI_GENERATION, { connection: redisConnection }),
      'QueueListener:Queue'
    );

    this.queueEvents = attachRedisErrorLogging(
      new QueueEvents(QUEUE_NAMES.AI_GENERATION, { connection: redisConnection }),
      'QueueListener:Events'
    );

    this._registerListeners();
  }

  /**
   * Accepts either an already-parsed object or a JSON string, and never throws.
   */
  static _coerceResult(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  async _loadJob(jobId) {
    try {
      return await Job.fromId(this.queue, jobId);
    } catch (err) {
      console.error(`[QueueListener] Failed to load job ${jobId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Emits to exactly one user's room. Returns false (and says so loudly) when the
   * identity is missing or malformed, so a dropped notification is never silent.
   */
  _emitToUser(userId, event, payload) {
    if (!isValidUserId(userId)) {
      console.error(
        `[QueueListener] Cannot deliver '${event}' for job ${payload?.jobId}: ` +
          `missing or invalid userId (${JSON.stringify(userId)}). Event dropped.`
      );
      return false;
    }

    const room = userRoom(userId);
    this.io.to(room).emit(event, payload);
    console.log(`[QueueListener] Emitted '${event}' for job ${payload?.jobId} -> ${room}`);
    return true;
  }

  _registerListeners() {
    console.log(
      `[QueueListener] Listening on queue '${QUEUE_NAMES.AI_GENERATION}' for job lifecycle events`
    );

    this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      try {
        const result = QueueListenerService._coerceResult(returnvalue);
        const job = await this._loadJob(jobId);

        // Job data is the authoritative identity (see class docblock, point 2).
        const userId = job?.data?.userId || result?.userId;

        // Fall back to the persisted return value if the stream payload was unusable.
        const payload = result?.itinerary
          ? result
          : QueueListenerService._coerceResult(job?.returnvalue);

        if (!payload?.itinerary) {
          console.error(
            `[QueueListener] Job ${jobId} completed but carried no itinerary. ` +
              `Notifying the user of failure rather than leaving them waiting.`
          );
          this._emitToUser(userId, SOCKET_EVENTS.ITINERARY_GENERATION_FAILED, {
            jobId,
            error: 'Generation finished but produced no itinerary.',
          });
          return;
        }

        this._emitToUser(userId, SOCKET_EVENTS.ITINERARY_GENERATED, {
          jobId,
          itinerary: payload.itinerary,
        });
      } catch (err) {
        // An unhandled throw inside an async event handler becomes an unhandled
        // rejection and can take the process down. Contain it here.
        console.error(
          `[QueueListener] Unexpected error handling completion of job ${jobId}: ${err.message}`
        );
      }
    });

    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      try {
        console.error(`[QueueListener] Job ${jobId} failed: ${failedReason}`);

        // The failed event carries no identity — this lookup is the only way to
        // route the notification, and is why it was previously left unimplemented.
        const job = await this._loadJob(jobId);
        const userId = job?.data?.userId;

        this._emitToUser(userId, SOCKET_EVENTS.ITINERARY_GENERATION_FAILED, {
          jobId,
          error: failedReason || 'Itinerary generation failed.',
        });
      } catch (err) {
        console.error(
          `[QueueListener] Unexpected error handling failure of job ${jobId}: ${err.message}`
        );
      }
    });

    this.queueEvents.on('stalled', async ({ jobId }) => {
      console.warn(`[QueueListener] Job ${jobId} stalled — worker may have died mid-job`);
    });
  }

  async close() {
    await Promise.allSettled([this.queueEvents.close(), this.queue.close()]);
  }
}

module.exports = QueueListenerService;
