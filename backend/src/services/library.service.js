'use strict';

const crypto = require('crypto');
const Itinerary = require('../models/Itinerary');
const Booking = require('../models/Booking');
const UserActivity = require('../models/UserActivity');
const Hotel = require('../models/Hotel');
const Restaurant = require('../models/Restaurant');
const TouristPlace = require('../models/TouristPlace');
const Flight = require('../models/Flight');
const Destination = require('../models/Destination');
const AppError = require('../utils/AppError');

/**
 * ============================================================================
 * WHAT THIS FILE DOES — "everything the user has collected"
 * ============================================================================
 * One service behind six features, because they're all the same idea:
 * things this user has done, listed newest first.
 *
 *   Trip History      every itinerary they generated
 *   Saved Trips       the subset they starred
 *   Favorites         hotels/restaurants/places they hearted
 *   Recently Viewed   destinations they opened
 *   Booking History   what they booked
 *   Trip Sharing      a public link to one itinerary
 *
 * Splitting these into six services would mean six near-identical
 * "find by user, sort by date, paginate" implementations.
 * ============================================================================
 */

/** Maps a refType to its model + the fields worth snapshotting. */
const REF_SOURCES = {
  hotel: { model: () => Hotel, name: (d) => d.hotelName, price: (d) => d.pricePerNight },
  restaurant: { model: () => Restaurant, name: (d) => d.name, price: (d) => d.priceForTwo },
  place: { model: () => TouristPlace, name: (d) => d.name, price: (d) => d.entryFeeInr },
  flight: { model: () => Flight, name: (d) => `${d.airline} ${d.flightNumber}`, price: (d) => d.price },
};

const buildSnapshot = (refType, doc) => {
  if (refType === 'destination') {
    return {
      name: doc.cityName,
      subtitle: [doc.state, doc.country].filter(Boolean).join(', '),
      // Deliberately null. This carried vrImageUrl — a stock photo picked by
      // tag, so a saved "Delhi" showed a picture of somewhere else. The UI
      // renders a tag-tinted tile when image is absent. Hotels, restaurants
      // and attractions below keep their images: those businesses are
      // generated, so generic imagery represents them honestly.
      image: null,
      citySlug: doc.citySlug,
      tags: doc.tags,
    };
  }
  const src = REF_SOURCES[refType];
  return {
    name: src.name(doc),
    subtitle: doc.address || doc.city || null,
    image: (doc.images && doc.images[0]) || null,
    price: src.price(doc) ?? null,
    rating: doc.rating ?? null,
    city: doc.city || null,
    citySlug: doc.citySlug || null,
    latitude: doc.latitude ?? null,
    longitude: doc.longitude ?? null,
  };
};

class LibraryService {
  // ---------------------------------------------------------------- trips

  /** Trip History — everything this user generated. */
  async listTrips(userId, { saved = false, limit = 20, page = 1 } = {}) {
    const filter = { ownerId: userId };
    if (saved) filter.isSaved = true;

    const skip = (Math.max(1, page) - 1) * limit;

    const [items, total] = await Promise.all([
      Itinerary.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // The full plan is large; a list only needs the header fields.
        .select('title trip_title summary destination origin profile isSaved shareToken viewCount totalEstimatedCostInr createdAt days.day_number generationMeta.groundingStats')
        .lean(),
      Itinerary.countDocuments(filter),
    ]);

    return {
      items: items.map((it) => ({
        ...it,
        title: it.title || it.trip_title,
        dayCount: it.days?.length || 0,
        days: undefined,
      })),
      total,
      page,
      hasMore: skip + items.length < total,
    };
  }

  async getTrip(userId, id) {
    const trip = await Itinerary.findById(id).lean();
    if (!trip) throw new AppError('Trip not found.', 404);
    if (trip.ownerId !== userId) throw new AppError('Trip not found.', 404);
    return trip;
  }

  async setSaved(userId, id, isSaved) {
    const trip = await Itinerary.findOneAndUpdate(
      { _id: id, ownerId: userId },
      { isSaved },
      { new: true }
    ).select('_id isSaved title trip_title').lean();

    if (!trip) throw new AppError('Trip not found.', 404);
    return trip;
  }

  async renameTrip(userId, id, title) {
    const clean = String(title || '').trim().slice(0, 120);
    if (!clean) throw new AppError('A title is required.', 400);

    const trip = await Itinerary.findOneAndUpdate(
      { _id: id, ownerId: userId },
      { title: clean },
      { new: true }
    ).select('_id title').lean();

    if (!trip) throw new AppError('Trip not found.', 404);
    return trip;
  }

  async deleteTrip(userId, id) {
    const res = await Itinerary.deleteOne({ _id: id, ownerId: userId });
    if (!res.deletedCount) throw new AppError('Trip not found.', 404);
    return { deleted: true };
  }

  // -------------------------------------------------------------- sharing

  /**
   * Creates an unguessable public link. 24 bytes of randomness — long enough
   * that the URL itself is the access control, which is the standard model for
   * "anyone with the link" sharing.
   */
  async shareTrip(userId, id) {
    const token = crypto.randomBytes(24).toString('base64url');

    const trip = await Itinerary.findOneAndUpdate(
      { _id: id, ownerId: userId },
      { shareToken: token, sharedAt: new Date() },
      { new: true }
    ).select('_id shareToken sharedAt').lean();

    if (!trip) throw new AppError('Trip not found.', 404);
    return trip;
  }

  async unshareTrip(userId, id) {
    const trip = await Itinerary.findOneAndUpdate(
      { _id: id, ownerId: userId },
      { $unset: { shareToken: 1 }, $set: { sharedAt: null } },
      { new: true }
    ).select('_id').lean();

    if (!trip) throw new AppError('Trip not found.', 404);
    return { shared: false };
  }

  /**
   * Public read. No auth — the token IS the credential.
   * Owner identity is stripped so a shared link never leaks who made it.
   */
  async getSharedTrip(token) {
    if (!token || typeof token !== 'string') throw new AppError('Invalid share link.', 400);

    const trip = await Itinerary.findOneAndUpdate(
      { shareToken: token },
      { $inc: { viewCount: 1 } },
      { new: true }
    ).lean();

    if (!trip) throw new AppError('This share link is not valid or has been revoked.', 404);

    const { ownerId, tripId, shareToken, ...publicTrip } = trip;
    return { ...publicTrip, isSharedView: true };
  }

  // ------------------------------------------------------------ favourites

  /** Toggle. Returns the new state so the UI knows which way it went. */
  async toggleFavorite(userId, refType, refId) {
    if (!REF_SOURCES[refType] && refType !== 'destination') {
      throw new AppError(`Cannot favourite a "${refType}".`, 400);
    }

    // Delete-first: if a row existed we've just un-favourited it in a single
    // round trip. Only on a miss do we need to look the item up and insert.
    const removed = await UserActivity.deleteOne({ userId, kind: 'favorite', refType, refId });
    if (removed.deletedCount) {
      return { favorited: false, refType, refId };
    }

    const doc = refType === 'destination'
      ? await Destination.findOne({ citySlug: refId }).lean()
      : await REF_SOURCES[refType].model().findById(refId).lean();

    if (!doc) throw new AppError('That item no longer exists.', 404);

    await UserActivity.create({
      userId,
      kind: 'favorite',
      refType,
      refId,
      snapshot: buildSnapshot(refType, doc),
      lastSeenAt: new Date(),
    });

    return { favorited: true, refType, refId };
  }

  async listFavorites(userId, { refType, limit = 50 } = {}) {
    const filter = { userId, kind: 'favorite' };
    if (refType) filter.refType = refType;

    const items = await UserActivity.find(filter)
      .sort({ lastSeenAt: -1 })
      .limit(limit)
      .lean();

    return { items, total: items.length };
  }

  /** Used by the UI to render heart icons in their correct state. */
  async getFavoriteIds(userId) {
    const rows = await UserActivity.find({ userId, kind: 'favorite' })
      .select('refType refId')
      .lean();
    return rows.map((r) => `${r.refType}:${r.refId}`);
  }

  // -------------------------------------------------------- recently viewed

  /**
   * Upsert rather than insert, so re-viewing a city moves it to the top
   * instead of filling the list with duplicates.
   */
  async recordView(userId, citySlug) {
    const dest = await Destination.findOne({ citySlug }).lean();
    if (!dest) return null;

    await UserActivity.findOneAndUpdate(
      { userId, kind: 'recently_viewed', refType: 'destination', refId: citySlug },
      { snapshot: buildSnapshot('destination', dest), lastSeenAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Keep only the most recent 12 so the collection can't grow unbounded.
    const stale = await UserActivity.find({ userId, kind: 'recently_viewed' })
      .sort({ lastSeenAt: -1 })
      .skip(12)
      .select('_id')
      .lean();

    if (stale.length) {
      await UserActivity.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    }

    return { recorded: citySlug };
  }

  async listRecentlyViewed(userId, { limit = 8 } = {}) {
    const items = await UserActivity.find({ userId, kind: 'recently_viewed' })
      .sort({ lastSeenAt: -1 })
      .limit(limit)
      .lean();
    return { items, total: items.length };
  }

  // --------------------------------------------------------------- bookings

  /**
   * Creates a booking with a SERVER-DERIVED price.
   *
   * The old endpoint took `amount` from the request body and echoed it back,
   * so a client could book anything for ₹1. Here the item is looked up and its
   * stored price is used; the client's number is ignored entirely.
   */
  async createBooking(userId, { serviceType, itemId, itineraryId }) {
    const typeToRef = { Hotel: 'hotel', Flight: 'flight', Restaurant: 'restaurant' };
    const refType = typeToRef[serviceType];

    let amount = 0;
    let title = `${serviceType} booking`;
    let snapshot = null;

    if (refType && itemId) {
      const doc = await REF_SOURCES[refType].model().findById(itemId).lean();
      if (!doc) throw new AppError('That item is no longer available.', 404);
      amount = REF_SOURCES[refType].price(doc) || 0;
      title = REF_SOURCES[refType].name(doc);
      snapshot = buildSnapshot(refType, doc);
    } else if (serviceType === 'Cab') {
      // Cabs are a fixed demo catalogue with no collection behind them.
      throw new AppError('Cab booking is not available yet.', 400);
    } else {
      throw new AppError('A valid item is required to book.', 400);
    }

    const referenceId = `VEL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const booking = await Booking.create({
      userId,
      referenceId,
      serviceType,
      itemId,
      title,
      amount,
      snapshot,
      itineraryId: itineraryId || null,
    });

    return booking.toObject();
  }

  async listBookings(userId, { status, limit = 30 } = {}) {
    const filter = { userId };
    if (status) filter.status = status;

    const [items, totalSpent] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      Booking.aggregate([
        { $match: { userId, status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    return {
      items,
      total: items.length,
      totalSpentInr: totalSpent[0]?.total || 0,
    };
  }

  async cancelBooking(userId, id) {
    const booking = await Booking.findOneAndUpdate(
      { _id: id, userId, status: 'confirmed' },
      { status: 'cancelled', cancelledAt: new Date() },
      { new: true }
    ).lean();

    if (!booking) throw new AppError('Booking not found or already cancelled.', 404);
    return booking;
  }

  // ------------------------------------------------------------- overview

  /** Single call powering the library header and nav badges. */
  async getOverview(userId) {
    const [trips, saved, favorites, bookings, recent] = await Promise.all([
      Itinerary.countDocuments({ ownerId: userId }),
      Itinerary.countDocuments({ ownerId: userId, isSaved: true }),
      UserActivity.countDocuments({ userId, kind: 'favorite' }),
      Booking.countDocuments({ userId, status: 'confirmed' }),
      UserActivity.countDocuments({ userId, kind: 'recently_viewed' }),
    ]);

    return { trips, saved, favorites, bookings, recentlyViewed: recent };
  }
}

module.exports = new LibraryService();
module.exports.buildSnapshot = buildSnapshot;
