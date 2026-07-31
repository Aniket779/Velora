'use strict';

const discover = require('../services/discover.service');
const assistant = require('../services/assistant.service');
const AppError = require('../utils/AppError');

const ok = (res, data) => res.json({ success: true, data });
const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) { next(err); }
};
const requireUser = (req) => {
  if (!req.userId) throw new AppError('A user identity is required.', 400);
  return req.userId;
};

// ------------------------------------------------------------------ nearby

/** GET /discover/nearby?lat=&lng=&radiusKm=&types=hotel,restaurant,place */
exports.nearby = wrap(async (req, res) => {
  const types = req.query.types ? String(req.query.types).split(',') : undefined;
  ok(res, await discover.nearby({
    lat: req.query.lat,
    lng: req.query.lng,
    radiusKm: req.query.radiusKm,
    types,
    limit: Math.min(20, Number(req.query.limit) || 8),
  }));
});

// ----------------------------------------------------------------- weather

exports.weather = wrap(async (req, res) => {
  ok(res, await discover.weather(req.params.citySlug, req.query.month));
});

// ------------------------------------------------------------------ budget

exports.budget = wrap(async (req, res) => {
  ok(res, await discover.budget({
    citySlug: req.params.citySlug,
    days: Number(req.query.days) || 3,
    travellers: Number(req.query.travellers) || 2,
    budgetTier: req.query.budgetTier || 'moderate',
  }));
});

// --------------------------------------------------------------- checklist

exports.getChecklist = wrap(async (req, res) => {
  ok(res, await discover.getOrCreateChecklist(requireUser(req), req.params.itineraryId));
});

exports.updateChecklistItem = wrap(async (req, res) => {
  ok(res, await discover.updateChecklistItem(
    requireUser(req), req.params.itineraryId, req.params.itemId, req.body?.done
  ));
});

exports.addChecklistItem = wrap(async (req, res) => {
  ok(res, await discover.addChecklistItem(
    requireUser(req), req.params.itineraryId, req.body?.label
  ));
});

// --------------------------------------------------------- recommendations

exports.recommendations = wrap(async (req, res) => {
  ok(res, await discover.recommendations(requireUser(req), {
    limit: Math.min(12, Number(req.query.limit) || 6),
  }));
});

// --------------------------------------------------------------- assistant

exports.chat = wrap(async (req, res) => {
  const { message, history, citySlug } = req.body || {};
  ok(res, await assistant.chat(requireUser(req), { message, history, citySlug }));
});
