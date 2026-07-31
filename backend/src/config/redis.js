'use strict';

/**
 * Single source of truth for the Redis connection and queue identifiers.
 *
 * Before this file existed the same connection literal was duplicated in three
 * places (ai.service.js, queueListener.service.js, aiGenerator.worker.js) and the
 * queue name string 'ai-generation-queue' was repeated alongside it. A typo in any
 * one of those copies silently detaches a producer from its consumer: jobs get
 * enqueued onto a queue nobody is listening to, with no error anywhere. Centralising
 * both removes that entire failure class.
 */

const buildRedisConnection = () => {
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
  };

  if (process.env.REDIS_USERNAME) {
    connection.username = process.env.REDIS_USERNAME;
  }

  if (process.env.REDIS_PASSWORD) {
    connection.password = process.env.REDIS_PASSWORD;
    // Upstash (and every managed Redis worth using) requires TLS.
    connection.tls = {};
  }

  return connection;
};

const redisConnection = buildRedisConnection();

const QUEUE_NAMES = Object.freeze({
  AI_GENERATION: 'ai-generation-queue',
});

const JOB_NAMES = Object.freeze({
  GENERATE_ITINERARY: 'generate-itinerary',
});

/**
 * Attaches a uniform error listener to any BullMQ primitive (Queue, Worker,
 * QueueEvents). Each of these opens its own Redis connection; an unhandled 'error'
 * on any of them is an unhandled event emitter error, which terminates the process.
 */
const attachRedisErrorLogging = (emitter, label) => {
  emitter.on('error', (err) => {
    console.error(`[Redis/${label}] Connection error: ${err.message}`);
  });
  return emitter;
};

module.exports = {
  redisConnection,
  buildRedisConnection,
  QUEUE_NAMES,
  JOB_NAMES,
  attachRedisErrorLogging,
};
