const tripService = require('../../services/trip.service');

// Controller methods wrap the service calls and handle ONLY HTTP concerns
const createTrip = async (req, res, next) => {
  try {
    // In a real app, userId comes from req.user (attached by auth middleware)
    const mockUserId = '60d21b4667d0d8992e610c85'; 
    
    const trip = await tripService.createTrip(req.body, mockUserId);
    
    res.status(201).json({
      status: 'success',
      data: { trip }
    });
  } catch (err) {
    next(err); // Passes to global error handler
  }
};

const getTrip = async (req, res, next) => {
  try {
    const trip = await tripService.getTripDetails(req.params.id);
    
    res.status(200).json({
      status: 'success',
      data: { trip }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTrip,
  getTrip
};
