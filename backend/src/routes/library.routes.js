'use strict';

const express = require('express');
const c = require('../controllers/library.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

/**
 * /api/v1/library/*  — everything the user has collected.
 *
 * Note the ONE public route: /shared/:token. The token is unguessable and
 * acts as the credential, which is the standard "anyone with the link" model.
 * It is declared BEFORE the router-wide requireAuth below, because middleware
 * order is what makes it public — move it down and the share link breaks for
 * everyone who isn't signed in.
 */

// Public share view — must stay above requireAuth.
router.get('/shared/:token', c.getSharedTrip);

// Everything past this line needs a real account. A guest gets 401, which the
// frontend turns into a "sign in to save" prompt.
router.use(requireAuth);

router.get('/overview', c.overview);

// Trips: history, saved, rename, delete
router.get('/trips', c.listTrips);
router.get('/trips/:id', c.getTrip);
router.patch('/trips/:id/save', c.saveTrip);
router.patch('/trips/:id/title', c.renameTrip);
router.delete('/trips/:id', c.deleteTrip);

// Sharing
router.post('/trips/:id/share', c.shareTrip);
router.delete('/trips/:id/share', c.unshareTrip);

// Favourites
router.get('/favorites', c.listFavorites);
router.get('/favorites/ids', c.favoriteIds);
router.post('/favorites/toggle', c.toggleFavorite);

// Recently viewed
router.get('/recently-viewed', c.listRecentlyViewed);
router.post('/recently-viewed', c.recordView);

// Bookings
router.get('/bookings', c.listBookings);
router.post('/bookings', c.createBooking);
router.patch('/bookings/:id/cancel', c.cancelBooking);

module.exports = router;
