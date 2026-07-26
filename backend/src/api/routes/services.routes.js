const express = require('express');
const router = express.Router();

// Mock Flights Database
const MOCK_FLIGHTS = [
  {
    id: 'fl-101',
    airline: 'Vistara',
    code: 'UK-815',
    logo: '✈️',
    from: 'DEL',
    to: 'BOM',
    departure: '06:00 AM',
    arrival: '08:15 AM',
    duration: '2h 15m',
    stops: 'Non-stop',
    price: 5499,
    tag: 'Cheapest'
  },
  {
    id: 'fl-102',
    airline: 'IndiGo',
    code: '6E-204',
    logo: '🛫',
    from: 'DEL',
    to: 'BOM',
    departure: '09:30 AM',
    arrival: '11:40 AM',
    duration: '2h 10m',
    stops: 'Non-stop',
    price: 6120,
    tag: 'Fastest'
  },
  {
    id: 'fl-103',
    airline: 'Air India',
    code: 'AI-502',
    logo: '✈️',
    from: 'DEL',
    to: 'BLR',
    departure: '02:15 PM',
    arrival: '05:00 PM',
    duration: '2h 45m',
    stops: 'Non-stop',
    price: 7250,
    tag: 'Premium'
  },
  {
    id: 'fl-104',
    airline: 'Emirates',
    code: 'EK-513',
    logo: '🌐',
    from: 'BOM',
    to: 'DXB',
    departure: '10:00 PM',
    arrival: '11:45 PM',
    duration: '3h 15m',
    stops: 'Non-stop',
    price: 18900,
    tag: 'Luxury'
  }
];

// Mock Hotels Database
const MOCK_HOTELS = [
  {
    id: 'ht-201',
    name: 'The Grand Palace Resort',
    location: 'Kyoto, Japan',
    rating: 4.9,
    reviewsCount: 1240,
    pricePerNight: 12500,
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    amenities: ['Free WiFi', 'Infinity Pool', 'Spa & Wellness', 'Breakfast Included'],
    category: '5 Star'
  },
  {
    id: 'ht-202',
    name: 'Velora Boutique Suites',
    location: 'Goa, India',
    rating: 4.7,
    reviewsCount: 890,
    pricePerNight: 6800,
    image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
    amenities: ['Beachfront', 'Bar & Lounge', 'Airport Shuttle', 'Pet Friendly'],
    category: '4 Star'
  },
  {
    id: 'ht-203',
    name: 'Alpine Heritage Villa',
    location: 'Manali, India',
    rating: 4.8,
    reviewsCount: 530,
    pricePerNight: 8900,
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
    amenities: ['Mountain View', 'Fireplace', 'Heated Pool', 'Free Parking'],
    category: '5 Star'
  }
];

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
router.get('/flights', (req, res) => {
  const { from, to } = req.query;
  let results = MOCK_FLIGHTS;
  if (from || to) {
    results = results.filter(f => 
      (!from || f.from.toLowerCase().includes(from.toLowerCase())) &&
      (!to || f.to.toLowerCase().includes(to.toLowerCase()))
    );
    if (results.length === 0) results = MOCK_FLIGHTS; // Fallback for demonstration
  }
  res.json({ success: true, count: results.length, data: results });
});

// GET /api/v1/services/hotels
router.get('/hotels', (req, res) => {
  const { city } = req.query;
  let results = MOCK_HOTELS;
  if (city) {
    results = results.filter(h => h.location.toLowerCase().includes(city.toLowerCase()));
    if (results.length === 0) results = MOCK_HOTELS; // Fallback for demonstration
  }
  res.json({ success: true, count: results.length, data: results });
});

// GET /api/v1/services/cabs
router.get('/cabs', (req, res) => {
  res.json({ success: true, count: MOCK_CABS.length, data: MOCK_CABS });
});

// POST /api/v1/services/book
router.post('/book', (req, res) => {
  const { serviceType, itemId, title, amount } = req.body;
  const bookingRef = 'VEL-' + Math.floor(100000 + Math.random() * 900000);
  
  res.json({
    success: true,
    message: 'Booking confirmed successfully!',
    booking: {
      referenceId: bookingRef,
      serviceType,
      itemId,
      title: title || 'Service Booking',
      amount,
      status: 'Confirmed',
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
