'use strict';

const openai = require('../ai/llm');
const Hotel = require('../models/Hotel');
const Restaurant = require('../models/Restaurant');
const TouristPlace = require('../models/TouristPlace');
const Destination = require('../models/Destination');
const Itinerary = require('../models/Itinerary');
const UserActivity = require('../models/UserActivity');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');

/**
 * ============================================================================
 * WHAT THIS FILE DOES — the travel assistant, for real this time
 * ============================================================================
 * The old assistant was a setTimeout that echoed your message back with
 * "Got it! I am tailoring options for X". It called nothing and knew nothing.
 *
 * This one follows the SAME pattern as itinerary generation, which is the
 * thing that makes Velora more than a ChatGPT wrapper:
 *
 *   1. RETRIEVE  work out what the question is about, pull that data from
 *                MongoDB — the user's trips, their favourites, and inventory
 *                for whatever city they mentioned
 *   2. GROUND    put that real data in the prompt
 *   3. ANSWER    the model answers FROM the data, and is told to say when it
 *                doesn't have something rather than invent it
 *
 * Without an API key it still works: retrieval runs and a deterministic
 * summary of the retrieved data is returned, clearly labelled.
 * ============================================================================
 */

const MAX_MESSAGE = 500;
const MAX_HISTORY = 6;

/** Cheap intent detection — good enough to decide what to fetch. */
const detectIntent = (message) => {
  const m = message.toLowerCase();
  if (/\b(my|saved|booked|booking|history|favourite|favorite|trip)\b/.test(m)) return 'personal';
  if (/\b(hotel|stay|accommodation|resort)\b/.test(m)) return 'hotels';
  if (/\b(eat|food|restaurant|dish|cuisine|dinner|lunch)\b/.test(m)) return 'restaurants';
  if (/\b(see|do|visit|attraction|sight|place)\b/.test(m)) return 'places';
  if (/\b(budget|cost|price|expensive|cheap|afford)\b/.test(m)) return 'budget';
  if (/\b(weather|season|when|month|climate)\b/.test(m)) return 'weather';
  return 'general';
};

class AssistantService {
  /**
   * Finds which known destination the user is talking about.
   * Matching against real city names avoids a whole class of nonsense — the
   * assistant can only ground in cities we actually have data for.
   */
  async _resolveCity(message, fallbackSlug) {
    const words = message.toLowerCase();

    // Longest names first, so "New York" wins over a stray "york".
    const all = await Destination.find().select('cityName citySlug country').lean();
    const match = all
      .sort((a, b) => b.cityName.length - a.cityName.length)
      .find((d) => words.includes(d.cityName.toLowerCase()));

    if (match) return match;
    if (fallbackSlug) return all.find((d) => d.citySlug === fallbackSlug) || null;
    return null;
  }

  /** Pulls only the data this question needs. */
  async _retrieve(userId, message, intent, city) {
    const context = {};

    if (intent === 'personal') {
      const [trips, favorites, bookings] = await Promise.all([
        Itinerary.find({ ownerId: userId })
          .sort({ createdAt: -1 }).limit(5)
          .select('title trip_title destination profile isSaved createdAt totalEstimatedCostInr')
          .lean(),
        UserActivity.find({ userId, kind: 'favorite' }).limit(10).select('refType snapshot').lean(),
        Booking.find({ userId, status: 'confirmed' }).sort({ createdAt: -1 }).limit(5)
          .select('referenceId serviceType title amount createdAt').lean(),
      ]);
      context.trips = trips;
      context.favorites = favorites;
      context.bookings = bookings;
    }

    if (city) {
      context.city = city;

      if (intent === 'hotels' || intent === 'budget' || intent === 'general') {
        context.hotels = await Hotel.find({ citySlug: city.citySlug })
          .sort({ rating: -1 }).limit(6)
          .select('hotelName pricePerNight rating address amenities').lean();
      }
      if (intent === 'restaurants' || intent === 'general') {
        context.restaurants = await Restaurant.find({ citySlug: city.citySlug })
          .sort({ rating: -1 }).limit(6)
          .select('name cuisine signatureDishes priceForTwo rating address').lean();
      }
      if (intent === 'places' || intent === 'general') {
        context.places = await TouristPlace.find({ citySlug: city.citySlug })
          .sort({ rating: -1 }).limit(6)
          .select('name category rating averageTimeRequired entryFeeInr').lean();
      }
      if (intent === 'weather' || intent === 'general') {
        const DestinationIntelligence = require('../models/DestinationIntelligence');
        const intel = await DestinationIntelligence.findOne({ citySlug: city.citySlug })
          .select('intelligence.weather intelligence.bestSeason intelligence.safetyTips').lean();
        context.weather = intel?.intelligence?.weather || null;
        context.bestSeason = intel?.intelligence?.bestSeason || null;
      }
    }

    return context;
  }

  /** Renders retrieved data as compact text for the prompt. */
  _renderContext(ctx) {
    const parts = [];

    if (ctx.trips?.length) {
      parts.push('THEIR RECENT TRIPS:\n' + ctx.trips.map((t) =>
        `  - ${t.title || t.trip_title} (${t.destination}, ${t.profile?.days || '?'} days, ${t.profile?.budget || '?'} budget)${t.isSaved ? ' [saved]' : ''}`
      ).join('\n'));
    }
    if (ctx.favorites?.length) {
      parts.push('THEIR FAVOURITES:\n' + ctx.favorites.map((f) =>
        `  - ${f.snapshot?.name} (${f.refType}${f.snapshot?.city ? ', ' + f.snapshot.city : ''})`
      ).join('\n'));
    }
    if (ctx.bookings?.length) {
      parts.push('THEIR BOOKINGS:\n' + ctx.bookings.map((b) =>
        `  - ${b.referenceId}: ${b.title} (${b.serviceType}, ₹${b.amount})`
      ).join('\n'));
    }
    if (ctx.city) parts.push(`CITY IN QUESTION: ${ctx.city.cityName}, ${ctx.city.country}`);

    if (ctx.hotels?.length) {
      parts.push('HOTELS WE HAVE:\n' + ctx.hotels.map((h) =>
        `  - ${h.hotelName} | ${h.rating}★ | ₹${h.pricePerNight}/night | ${h.address}`
      ).join('\n'));
    }
    if (ctx.restaurants?.length) {
      parts.push('RESTAURANTS WE HAVE:\n' + ctx.restaurants.map((r) =>
        `  - ${r.name} | ${r.rating}★ | ₹${r.priceForTwo} for two | ${(r.cuisine || []).join('/')}` +
        `${r.signatureDishes?.length ? ` | known for ${r.signatureDishes.join(', ')}` : ''}`
      ).join('\n'));
    }
    if (ctx.places?.length) {
      parts.push('ATTRACTIONS WE HAVE:\n' + ctx.places.map((p) =>
        `  - ${p.name} | ${p.category} | ${p.rating}★ | ${p.averageTimeRequired}` +
        `${p.entryFeeInr ? ` | ₹${p.entryFeeInr} entry` : ' | free'}`
      ).join('\n'));
    }
    if (ctx.weather) {
      parts.push('CLIMATE:\n  ' + (ctx.weather.overview || '') +
        (ctx.bestSeason ? `\n  Best months: ${ctx.bestSeason.recommendedMonths}. Avoid: ${ctx.bestSeason.monthsToAvoid}` : ''));
    }

    return parts.join('\n\n');
  }

  /** Fallback answer when no API key is configured. Still uses real data. */
  _deterministicAnswer(ctx, intent) {
    const lines = [];
    if (ctx.trips?.length) lines.push(`You have ${ctx.trips.length} recent trip(s): ${ctx.trips.map((t) => t.destination).join(', ')}.`);
    if (ctx.favorites?.length) lines.push(`You've favourited ${ctx.favorites.length} item(s).`);
    if (ctx.bookings?.length) lines.push(`You have ${ctx.bookings.length} confirmed booking(s).`);
    if (ctx.hotels?.length) lines.push(`Top-rated stays in ${ctx.city.cityName}: ${ctx.hotels.slice(0, 3).map((h) => `${h.hotelName} (₹${h.pricePerNight}/night)`).join(', ')}.`);
    if (ctx.restaurants?.length) lines.push(`Well-rated places to eat: ${ctx.restaurants.slice(0, 3).map((r) => r.name).join(', ')}.`);
    if (ctx.places?.length) lines.push(`Worth seeing: ${ctx.places.slice(0, 3).map((p) => p.name).join(', ')}.`);
    if (ctx.bestSeason) lines.push(`Best time to visit: ${ctx.bestSeason.recommendedMonths}.`);

    if (!lines.length) {
      lines.push("I couldn't find anything in the database matching that. Try naming a city, or ask about your saved trips.");
    }

    return lines.join(' ') +
      '\n\n(Answered from database records only — OPENAI_API_KEY is not configured, so this is not AI-generated.)';
  }

  async chat(userId, { message, history = [], citySlug }) {
    const clean = String(message || '').trim().slice(0, MAX_MESSAGE);
    if (!clean) throw new AppError('A message is required.', 400);

    const intent = detectIntent(clean);
    const city = await this._resolveCity(clean, citySlug);
    const context = await this._retrieve(userId, clean, intent, city);
    const contextText = this._renderContext(context);

    // Everything the assistant can act on, so the UI can offer real buttons.
    const suggestions = [];
    if (city) {
      suggestions.push({ label: `Plan a trip to ${city.cityName}`, action: 'plan', citySlug: city.citySlug });
      suggestions.push({ label: `See ${city.cityName} guide`, action: 'destination', citySlug: city.citySlug });
    }

    if (!openai.isConfigured) {
      return {
        reply: this._deterministicAnswer(context, intent),
        intent,
        city: city ? { name: city.cityName, slug: city.citySlug } : null,
        grounded: Boolean(contextText),
        isMock: true,
        suggestions,
      };
    }

    const systemPrompt = `You are Velora's travel assistant. You answer using ONLY the data provided below.

HARD RULES:
1. Recommend ONLY hotels, restaurants and attractions that appear in the data. Never invent a venue name.
2. If the data doesn't contain the answer, say so plainly and suggest what the user could search for instead.
3. Quote real prices and ratings from the data. Don't estimate when a real number is available.
4. Be concise — 2-4 sentences unless asked for detail. This is a chat widget, not an essay.
5. Refer to the user's own trips and favourites when they're relevant.

${contextText ? `DATA AVAILABLE:\n${contextText}` : 'NO DATA MATCHED THIS QUESTION. Say so and suggest naming a city.'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-MAX_HISTORY).map((h) => ({
        role: h.sender === 'user' ? 'user' : 'assistant',
        content: String(h.text || '').slice(0, MAX_MESSAGE),
      })),
      { role: 'user', content: clean },
    ];

    const reply = await openai.chat({
      label: `assistant[${intent}]`,
      messages,
      temperature: 0.5,
      maxTokens: 400,
    });

    return {
      reply,
      intent,
      city: city ? { name: city.cityName, slug: city.citySlug } : null,
      grounded: Boolean(contextText),
      isMock: false,
      suggestions,
    };
  }
}

module.exports = new AssistantService();
module.exports.detectIntent = detectIntent;
