const Trip = require('../models/Trip');

class TripRepository {
  async create(tripData) {
    const trip = new Trip(tripData);
    return await trip.save();
  }

  async findById(tripId) {
    return await Trip.findById(tripId).populate('owner_id', 'name email');
  }

  async findByOwner(userId) {
    return await Trip.find({ owner_id: userId }).sort({ startDate: 1 });
  }

  // Example of isolating complex Mongoose queries
  async findUpcomingTripsForUser(userId) {
    return await Trip.find({
      owner_id: userId,
      startDate: { $gte: new Date() }
    }).sort({ startDate: 1 });
  }
}

module.exports = new TripRepository();
