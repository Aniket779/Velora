'use strict';

const express = require('express');
const c = require('../controllers/discover.controller');
const { requireIdentity } = require('../middlewares/auth');

const router = express.Router();

/** /api/v1/discover/* — nearby, weather, budget, checklist, recommendations, assistant. */

// --- Public. Reference data about places, not about a person. -----------------

// Geo — powers Nearby Hotels / Restaurants / Attractions from one endpoint.
router.get('/nearby', c.nearby);

// Per-destination planning tools
router.get('/weather/:citySlug', c.weather);
router.get('/budget/:citySlug', c.budget);

// --- Personal. Guest or account, but never anonymous. -------------------------
// These use requireIdentity rather than requireAuth so a guest can still use
// the checklist on a trip they just generated. Ownership itself is enforced in
// discover.service, which scopes every query with `ownerId: userId` — the
// middleware proves *who* you are, the query proves the row is *yours*.

router.get('/checklist/:itineraryId', requireIdentity, c.getChecklist);
router.post('/checklist/:itineraryId', requireIdentity, c.addChecklistItem);
router.patch('/checklist/:itineraryId/:itemId', requireIdentity, c.updateChecklistItem);

router.get('/recommendations', requireIdentity, c.recommendations);

// AI assistant
router.post('/assistant/chat', requireIdentity, c.chat);

module.exports = router;
