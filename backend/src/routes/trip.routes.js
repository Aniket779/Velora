'use strict';

const express = require('express');
const tripController = require('../controllers/trip.controller');
const { requireIdentity, requireAuth } = require('../middlewares/auth');

const router = express.Router();

/**
 * Generation is deliberately open to guests — a visitor should be able to see
 * the AI work before being asked to sign up. It still needs `requireIdentity`
 * because the result is pushed back over a per-user socket room, so we must
 * know which browser to deliver it to.
 */

// Static and multi-segment paths are declared before the '/:id' catch-all so that
// '/generate' can never be swallowed as a trip id.
router.post('/generate', requireIdentity, tripController.generateTrip);
router.get('/generate/:jobId', requireIdentity, tripController.getGenerationStatus);

// Persisting a Trip is account-owned data.
router.post('/', requireAuth, tripController.createTrip);
router.get('/:id', requireIdentity, tripController.getTrip);

module.exports = router;
