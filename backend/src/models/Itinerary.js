const mongoose = require('mongoose');

const itinerarySchema = new mongoose.Schema(
  {
    tripId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Trip', 
      required: true,
      index: true 
    },
    versionName: { 
      type: String,
      required: true,
      trim: true
    },
    isAIOriginal: { 
      type: Boolean, 
      default: false 
    },
    
    // --- Day-wise Nested Structure ---
    days: [
      {
        day_number: { type: Number, required: true },
        date: { type: Date },
        activities: [
          {
            title: { type: String, required: true },
            type: { type: String, enum: ['hotel', 'food', 'activity', 'transit'] },
            location_name: { type: String },
            coordinates: {
              type: [Number], // GeoJSON [longitude, latitude]
              index: '2dsphere'
            },
            start_time: { type: String },
            end_time: { type: String }
          }
        ]
      }
    ]
  }, 
  { timestamps: true }
);

module.exports = mongoose.model('Itinerary', itinerarySchema);
