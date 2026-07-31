'use strict';

const library = require('../services/library.service');
const AppError = require('../utils/AppError');

/**
 * HTTP layer for the user's library. Controllers stay thin — request in,
 * response out, all logic in library.service.
 */

/** Every route here needs an identity except the public share view. */
const requireUser = (req) => {
  if (!req.userId) throw new AppError('A user identity is required.', 400);
  return req.userId;
};

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) { next(err); }
};

// ------------------------------------------------------------------- trips

exports.listTrips = wrap(async (req, res) => {
  const data = await library.listTrips(requireUser(req), {
    saved: req.query.saved === 'true',
    limit: Math.min(50, Number(req.query.limit) || 20),
    page: Number(req.query.page) || 1,
  });
  ok(res, data);
});

exports.getTrip = wrap(async (req, res) => {
  ok(res, await library.getTrip(requireUser(req), req.params.id));
});

exports.saveTrip = wrap(async (req, res) => {
  ok(res, await library.setSaved(requireUser(req), req.params.id, req.body?.isSaved !== false));
});

exports.renameTrip = wrap(async (req, res) => {
  ok(res, await library.renameTrip(requireUser(req), req.params.id, req.body?.title));
});

exports.deleteTrip = wrap(async (req, res) => {
  ok(res, await library.deleteTrip(requireUser(req), req.params.id));
});

// ----------------------------------------------------------------- sharing

exports.shareTrip = wrap(async (req, res) => {
  const trip = await library.shareTrip(requireUser(req), req.params.id);
  ok(res, {
    ...trip,
    // The frontend builds the full URL; the API shouldn't assume the origin.
    sharePath: `/shared/${trip.shareToken}`,
  }, 201);
});

exports.unshareTrip = wrap(async (req, res) => {
  ok(res, await library.unshareTrip(requireUser(req), req.params.id));
});

/** PUBLIC — no identity required. The token is the credential. */
exports.getSharedTrip = wrap(async (req, res) => {
  ok(res, await library.getSharedTrip(req.params.token));
});

// -------------------------------------------------------------- favourites

exports.toggleFavorite = wrap(async (req, res) => {
  const { refType, refId } = req.body || {};
  if (!refType || !refId) throw new AppError('refType and refId are required.', 400);
  ok(res, await library.toggleFavorite(requireUser(req), refType, String(refId)));
});

exports.listFavorites = wrap(async (req, res) => {
  ok(res, await library.listFavorites(requireUser(req), { refType: req.query.refType }));
});

exports.favoriteIds = wrap(async (req, res) => {
  ok(res, { ids: await library.getFavoriteIds(requireUser(req)) });
});

// ---------------------------------------------------------- recently viewed

exports.recordView = wrap(async (req, res) => {
  const { citySlug } = req.body || {};
  if (!citySlug) throw new AppError('citySlug is required.', 400);
  ok(res, await library.recordView(requireUser(req), String(citySlug)));
});

exports.listRecentlyViewed = wrap(async (req, res) => {
  ok(res, await library.listRecentlyViewed(requireUser(req)));
});

// ---------------------------------------------------------------- bookings

exports.createBooking = wrap(async (req, res) => {
  const { serviceType, itemId, itineraryId } = req.body || {};
  if (!serviceType) throw new AppError('serviceType is required.', 400);
  // Note: `amount` from the body is deliberately ignored — the service
  // derives price from the referenced inventory item.
  ok(res, await library.createBooking(requireUser(req), { serviceType, itemId, itineraryId }), 201);
});

exports.listBookings = wrap(async (req, res) => {
  ok(res, await library.listBookings(requireUser(req), { status: req.query.status }));
});

exports.cancelBooking = wrap(async (req, res) => {
  ok(res, await library.cancelBooking(requireUser(req), req.params.id));
});

// ---------------------------------------------------------------- overview

exports.overview = wrap(async (req, res) => {
  ok(res, await library.getOverview(requireUser(req)));
});
