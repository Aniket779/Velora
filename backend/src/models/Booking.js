'use strict';

const mongoose = require('mongoose');

/**
 * ============================================================================
 * BOOKING
 * ============================================================================
 * Previously the booking endpoint invented a reference number and persisted
 * nothing at all — there was no booking history because there were no
 * bookings. This is the missing collection.
 *
 * PRICE IS NEVER TAKEN FROM THE CLIENT. The service looks the item up by id
 * and uses the stored price. The old endpoint echoed back whatever `amount`
 * the browser sent, which meant you could book a ₹50,000 flight for ₹1.
 *
 * Still a demo flow: no payment provider is involved. `paymentStatus` stays
 * 'demo' so nothing here can be mistaken for a real transaction.
 * ============================================================================
 */

const BOOKING_STATUSES = ['confirmed', 'cancelled'];
const SERVICE_TYPES = ['Hotel', 'Flight', 'Cab', 'Restaurant'];

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    referenceId: { type: String, required: true, unique: true },

    serviceType: { type: String, required: true, enum: SERVICE_TYPES },
    itemId: { type: String, default: null },
    title: { type: String, required: true },

    /** Server-derived from the referenced inventory item, never client-supplied. */
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },

    /** Small copy of what was booked, so history renders without a join. */
    snapshot: { type: mongoose.Schema.Types.Mixed, default: null },

    status: { type: String, enum: BOOKING_STATUSES, default: 'confirmed' },
    paymentStatus: { type: String, default: 'demo' },

    /** Set when a booking is made from inside a generated itinerary. */
    itineraryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Itinerary', default: null },

    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The history query: "my bookings, newest first".
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
module.exports.SERVICE_TYPES = SERVICE_TYPES;
