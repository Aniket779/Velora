const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    preferences: {
      budget: {
        type: String,
        enum: ['budget', 'moderate', 'luxury'],
        default: 'moderate',
      },
      travelStyle: {
        type: [String],
        default: [],
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
