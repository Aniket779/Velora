const tripRepository = require('../repositories/trip.repository');
const AppError = require('../utils/AppError');

class TripService {
  async createTrip(tripData, userId) {
    if (!tripData.title || !tripData.startDate || !tripData.endDate) {
      throw new AppError('Missing required trip fields', 400);
    }

    if (new Date(tripData.startDate) > new Date(tripData.endDate)) {
      throw new AppError('Start date must be before end date', 400);
    }

    const newTrip = {
      ...tripData,
      owner_id: userId,
      status: 'planning'
    };

    return await tripRepository.create(newTrip);
  }

  async getTripDetails(tripId) {
    const trip = await tripRepository.findById(tripId);
    if (!trip) {
      throw new AppError('Trip not found', 404);
    }
    return trip;
  }
}

module.exports = new TripService();
