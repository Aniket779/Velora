const Trip = require('../models/Trip');
const Itinerary = require('../models/Itinerary');

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

  // --- Versioning & AI Persistence ---
  async saveAIGeneratedItinerary(tripId, generatedData) {
    // 1. Create the new Itinerary Document
    const itinerary = new Itinerary({
      tripId,
      versionName: 'AI Original Draft',
      isAIOriginal: true,
      days: generatedData.days
    });
    const savedItinerary = await itinerary.save();

    // 2. Update the Trip document pointers
    // Note: If tripId is temporary ('temp_trip_123'), we would normally create a Trip here first.
    // For now, if tripId is a valid ObjectId, we update it.
    if (mongoose.Types.ObjectId.isValid(tripId)) {
      await Trip.findByIdAndUpdate(tripId, {
        originalAIVersion: savedItinerary._id,
        currentVersion: savedItinerary._id,
        title: generatedData.trip_title // Auto-fill title from AI
      });
    }

    return savedItinerary;
  }
}

module.exports = new TripRepository();
