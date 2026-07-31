const express = require('express');
const router = express.Router();
const travelController = require('../controllers/travel.controller');

// GET /api/hotels?city=Goa
router.get('/hotels', travelController.getHotels);

// GET /api/restaurants?city=Goa
router.get('/restaurants', travelController.getRestaurants);

// GET /api/places?city=Goa
router.get('/places', travelController.getPlaces);

// GET /api/flights?from=Delhi&to=Goa
router.get('/flights', travelController.getFlights);

// GET /api/destinations?city=Goa
router.get('/destinations', travelController.getDestinations);

module.exports = router;
