const express = require('express');
const router = express.Router();
const Hotel = require('../models/Hotel');
const Flight = require('../models/Flight');

// Mock Cabs Database
const MOCK_CABS = [
  {
    id: 'cb-301',
    name: 'Prime Sedan',
    type: 'Sedan',
    model: 'Dzire / Etios or equivalent',
    capacity: '4 Seats',
    eta: '4 mins away',
    driverRating: 4.9,
    price: 650,
    badge: 'Popular'
  },
  {
    id: 'cb-302',
    name: 'Executive SUV',
    type: 'SUV',
    model: 'Innova Crysta',
    capacity: '6 Seats',
    eta: '7 mins away',
    driverRating: 4.85,
    price: 1250,
    badge: 'Spacious'
  },
  {
    id: 'cb-303',
    name: 'Velora Electric Go',
    type: 'EV Hatchback',
    model: 'Tata Nexon EV',
    capacity: '4 Seats',
    eta: '3 mins away',
    driverRating: 4.95,
    price: 520,
    badge: 'Eco-Friendly'
  }
];

// GET /api/v1/services/flights
router.get('/flights', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};

    if (from) filter.from = { $regex: new RegExp(from.trim(), 'i') };
    if (to) filter.to = { $regex: new RegExp(to.trim(), 'i') };

    let dbFlights = await Flight.find(filter).limit(30).lean();

    if (dbFlights.length === 0 && (!from || !to)) {
      dbFlights = await Flight.find({}).limit(30).lean();
    }

    const formatted = dbFlights.map((f, idx) => ({
      id: f._id.toString(),
      airline: f.airline,
      code: f.flightNumber,
      logo: '✈️',
      from: f.from,
      to: f.to,
      departure: f.departureTime,
      arrival: f.arrivalTime,
      duration: f.duration,
      stops: 'Non-stop',
      price: f.price,
      tag: idx % 4 === 0 ? 'Cheapest' : idx % 4 === 1 ? 'Fastest' : 'Popular'
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('Error fetching flights in services router:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/services/hotels
router.get('/hotels', async (req, res) => {
  try {
    const { city } = req.query;
    const filter = {};

    if (city) filter.city = { $regex: new RegExp(city.trim(), 'i') };

    let dbHotels = await Hotel.find(filter).limit(30).lean();

    if (dbHotels.length === 0 && !city) {
      dbHotels = await Hotel.find({}).limit(30).lean();
    }

    const formatted = dbHotels.map(h => ({
      id: h._id.toString(),
      name: h.hotelName,
      location: `${h.city}, ${h.state}`,
      rating: h.rating,
      reviewsCount: h.totalReviews || 120,
      pricePerNight: h.pricePerNight,
      image: (h.images && h.images[0]) || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
      amenities: h.amenities || ['Free WiFi', 'Breakfast Included'],
      category: h.rating >= 4.7 ? '5 Star Luxury' : '4 Star Premium'
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('Error fetching hotels in services router:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/services/cabs
router.get('/cabs', (req, res) => {
  res.json({ success: true, count: MOCK_CABS.length, data: MOCK_CABS });
});

/**
 * REMOVED: POST /book
 *
 * It replied "Booking confirmed successfully!" with a random reference number
 * and saved nothing — no database write, no owner, no way to ever see the
 * booking again. Nothing called it; the real endpoint is
 * POST /api/v1/library/bookings, which persists a Booking, derives the price
 * server-side, and now requires an account.
 *
 * Worth deleting rather than leaving: it was a public endpoint that told
 * anyone who found it that their booking had succeeded.
 */

module.exports = router;
