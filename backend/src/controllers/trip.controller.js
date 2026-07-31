'use strict';

const tripService = require('../services/trip.service');
const aiService = require('../services/ai.service');
const AppError = require('../utils/AppError');

// Controller methods wrap the service calls and handle ONLY HTTP concerns.

const createTrip = async (req, res, next) => {
  try {
    if (!req.userId) {
      return next(new AppError('A user identity is required to create a trip.', 400));
    }

    const trip = await tripService.createTrip(req.body, req.userId);

    res.status(201).json({
      status: 'success',
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

const getTrip = async (req, res, next) => {
  try {
    const trip = await tripService.getTripDetails(req.params.id);

    res.status(200).json({
      status: 'success',
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Enqueues generation and returns 202 with a jobId.
 *
 * The jobId is the whole point of this response: it is how the client correlates
 * the eventual socket event (or poll result) with the request it made, and how it
 * discards results belonging to a request it has already abandoned.
 */
const generateTrip = async (req, res, next) => {
  try {
    if (!req.userId) {
      return next(
        new AppError(
          'A user identity is required to generate an itinerary. Send an x-user-id header.',
          400
        )
      );
    }

    // TODO(M8): create a real Trip document here and pass its ObjectId, so the
    // generated Itinerary links back instead of being orphaned behind a synthetic id.
    const tripId = `temp_trip_${Date.now()}`;

    const result = await aiService.requestItineraryGeneration(req.userId, tripId, req.body);

    res.status(202).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Polling fallback used by the client when the socket has not delivered a result.
 */
const getGenerationStatus = async (req, res, next) => {
  try {
    if (!req.userId) {
      return next(new AppError('A user identity is required.', 400));
    }

    const status = await aiService.getGenerationStatus(req.params.jobId, req.userId);

    res.status(200).json({
      status: 'success',
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTrip,
  getTrip,
  generateTrip,
  getGenerationStatus,
};
