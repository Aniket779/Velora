const Trip = require('../models/Trip');
const Itinerary = require('../models/Itinerary');
const mongoose = require('mongoose');

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

  async findUpcomingTripsForUser(userId) {
    return await Trip.find({
      owner_id: userId,
      startDate: { $gte: new Date() }
    }).sort({ startDate: 1 });
  }

  // --- Versioning & AI Persistence ---
  async saveAIGeneratedItinerary(tripId, generatedData) {
    const itinerary = new Itinerary({
      tripId: tripId || 'temp_trip_' + Date.now(),
      ownerId: generatedData.ownerId,
      title: generatedData.title || generatedData.trip_title,
      trip_title: generatedData.trip_title || `Trip to ${generatedData.destination || 'Destination'}`,
      summary: generatedData.summary,
      destination: generatedData.destination,
      origin: generatedData.origin,
      profile: generatedData.profile || null,
      versionName: 'AI Original Draft',
      isAIOriginal: true,
      days: generatedData.days || [],
      totalEstimatedCostInr: generatedData.totalEstimatedCostInr,
      personalisationNotes: generatedData.personalisationNotes || [],
      packingReminders: generatedData.packingReminders || [],
      destinationIntelligence: generatedData.destinationIntelligence || null,
      intelligenceMeta: generatedData.intelligenceMeta || null,
      generationMeta: generatedData.generationMeta || null,
      travelData: generatedData.travelData || {
        destinationInfo: null,
        hotels: [],
        restaurants: [],
        places: [],
        flights: []
      }
    });

    const savedItinerary = await itinerary.save();

    if (mongoose.Types.ObjectId.isValid(tripId)) {
      await Trip.findByIdAndUpdate(tripId, {
        originalAIVersion: savedItinerary._id,
        currentVersion: savedItinerary._id,
        title: generatedData.trip_title
      });
    }

    return savedItinerary.toObject();
  }
}

module.exports = new TripRepository();
