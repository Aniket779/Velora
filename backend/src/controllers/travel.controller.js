const Hotel = require('../models/Hotel');
const Flight = require('../models/Flight');
const Restaurant = require('../models/Restaurant');
const TouristPlace = require('../models/TouristPlace');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / Math.max(limit, 1))),
  hasMore: page * limit < total
});

const getPaginationParams = (req) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 8));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

// GET /api/hotels?city=Goa
exports.getHotels = async (req, res, next) => {
  try {
    const { city, minPrice, maxPrice, rating } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const filter = {};

    if (city) {
      const normalizedCity = city.split(',')[0].trim();
      filter.city = {
        $in: [
          new RegExp(`^${escapeRegex(normalizedCity)}$`, 'i'),
          new RegExp(`^${escapeRegex(normalizedCity)}s?$`, 'i')
        ]
      };
    }
    if (minPrice || maxPrice) {
      filter.pricePerNight = {};
      if (minPrice) filter.pricePerNight.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerNight.$lte = Number(maxPrice);
    }
    if (rating) {
      filter.rating = { $gte: Number(rating) };
    }

    const [hotels, total] = await Promise.all([
      Hotel.find(filter)
        .sort({ rating: -1, pricePerNight: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Hotel.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: hotels.length,
      pagination: buildPagination(page, limit, total),
      data: hotels
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/restaurants?city=Goa
exports.getRestaurants = async (req, res, next) => {
  try {
    const { city, cuisine, rating } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const filter = {};

    if (city) {
      const normalizedCity = city.split(',')[0].trim();
      filter.city = {
        $in: [
          new RegExp(`^${escapeRegex(normalizedCity)}$`, 'i'),
          new RegExp(`^${escapeRegex(normalizedCity)}s?$`, 'i')
        ]
      };
    }
    if (cuisine) {
      filter.cuisine = { $in: [new RegExp(escapeRegex(cuisine.trim()), 'i')] };
    }
    if (rating) {
      filter.rating = { $gte: Number(rating) };
    }

    const [restaurants, total] = await Promise.all([
      Restaurant.find(filter)
        .sort({ rating: -1, priceForTwo: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Restaurant.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: restaurants.length,
      pagination: buildPagination(page, limit, total),
      data: restaurants
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/places?city=Goa
exports.getPlaces = async (req, res, next) => {
  try {
    const { city, category, rating } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const filter = {};

    if (city) {
      const normalizedCity = city.split(',')[0].trim();
      filter.city = {
        $in: [
          new RegExp(`^${escapeRegex(normalizedCity)}$`, 'i'),
          new RegExp(`^${escapeRegex(normalizedCity)}s?$`, 'i')
        ]
      };
    }
    if (category) {
      filter.category = { $regex: new RegExp(escapeRegex(category.trim()), 'i') };
    }
    if (rating) {
      filter.rating = { $gte: Number(rating) };
    }

    const [places, total] = await Promise.all([
      TouristPlace.find(filter)
        .sort({ rating: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TouristPlace.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: places.length,
      pagination: buildPagination(page, limit, total),
      data: places
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/flights?from=Delhi&to=Goa
exports.getFlights = async (req, res, next) => {
  try {
    const { from, to, airline, maxPrice } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const filter = {};

    if (from) {
      const normalizedFrom = from.split(',')[0].trim();
      filter.from = { $regex: new RegExp(`^${escapeRegex(normalizedFrom)}$`, 'i') };
    }
    if (to) {
      const normalizedTo = to.split(',')[0].trim();
      filter.to = { $regex: new RegExp(`^${escapeRegex(normalizedTo)}$`, 'i') };
    }
    if (airline) {
      filter.airline = { $regex: new RegExp(escapeRegex(airline.trim()), 'i') };
    }
    if (maxPrice) {
      filter.price = { $lte: Number(maxPrice) };
    }

    const [flights, total] = await Promise.all([
      Flight.find(filter)
        .sort({ price: 1, departureTime: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Flight.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: flights.length,
      pagination: buildPagination(page, limit, total),
      data: flights
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/destinations?city=Goa
exports.getDestinations = async (req, res, next) => {
  try {
    const Destination = require('../models/Destination');
    const { city } = req.query;
    const filter = {};

    if (city) {
      const normalizedCity = city.split(',')[0].trim();
      filter.cityName = {
        $in: [
          new RegExp(`^${escapeRegex(normalizedCity)}$`, 'i'),
          new RegExp(`^${escapeRegex(normalizedCity)}s?$`, 'i')
        ]
      };
    }

    const destinations = await Destination.find(filter).lean();

    res.json({
      success: true,
      count: destinations.length,
      data: destinations
    });
  } catch (error) {
    next(error);
  }
};
