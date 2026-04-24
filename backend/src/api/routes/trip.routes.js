const express = require('express');
const tripController = require('../controllers/trip.controller');

const router = express.Router();

// Maps HTTP endpoints to Controller methods cleanly
router.post('/', tripController.createTrip);
router.get('/:id', tripController.getTrip);

module.exports = router;
