const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    destination: {
      type: String,
      required: true,
    },
    budget: {
      type: String,
      enum: ['budget', 'moderate', 'luxury'],
      default: 'moderate'
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['planning', 'booked', 'active', 'completed'],
      default: 'planning',
    },
    // --- Versioning Pointers ---
    originalAIVersion: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Itinerary' 
    },
    currentVersion: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Itinerary' 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
