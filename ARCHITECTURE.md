# Velora — Architecture Map

**Read this before an interview. It is the map of your own repo.**

---

## The whole project in 5 ideas

If you remember nothing else, remember these five. Everything in the codebase is one of them.

### 1. Async job queue — "don't make the user wait"

AI generation takes 20–40 seconds. An HTTP request that waits that long will time out, and the server can't do anything else meanwhile.

So instead: the API drops the request into a **Redis queue (BullMQ)** and immediately replies `202 Accepted` with a `jobId`. A separate **worker** picks it up and does the slow work.

### 2. RAG grounding — "make the AI use our real data"

A normal ChatGPT wrapper asks *"plan a trip to Goa"* and gets back invented hotel names.

Velora does the opposite order:

```
1. Query MongoDB  ->  12 real hotels, 15 restaurants, 20 places
2. Label them     ->  H1, H2, R1, R2, P1, P2...
3. Put that list INSIDE the prompt
4. Tell the AI: "pick from this list, reference by code"
```

The AI **selects** instead of **inventing**. This is called RAG — Retrieval Augmented Generation.

### 3. Verification — "trust but verify"

Step 2 *asks* the AI to behave. This step *checks* that it did.

Every code the AI returns (`H1`) is looked up in the catalogue. If it invented `H99`, the job **fails** and the user sees an honest error. If fewer than 50% of activities use real data, it also fails.

> This is the part most projects don't have, and it's your best talking point.

### 4. Caching — "don't pay twice"

Goa's history doesn't change between users. The 18-category city briefing is generated once, stored in MongoDB, and reused for 90 days.

### 5. Two-tier identity — "browse as a guest, sign in to keep things"

Every route in the app reads one value: `req.userId`. There are two ways to get one, and they are not equally trusted:

```
JWT (verified signature)   ->  req.userId = account's ObjectId   -> can reach account data
x-user-id: guest_a1b2...   ->  req.userId = that guest id        -> anonymous data only
```

The `guest_` prefix is the security boundary. The header is trivially forged, so if account ids looked like valid header values, anyone could send `x-user-id: <your ObjectId>` and read your trips. Because a 24-character ObjectId can never match `^guest_[A-Za-z0-9]{8,56}$`, a forged header can only ever impersonate another anonymous guest.

Two middlewares consume this: `requireAuth` (401s guests — used on everything in the library) and `requireIdentity` (guests welcome, but *someone* must be identified — used on generation, because the result is pushed to a per-user socket room).

---

## Request flow (the one diagram to memorise)

```
BROWSER                    API SERVER                 REDIS        WORKER            MONGODB
   |                           |                        |             |                  |
   |-- POST /trips/generate -->|                        |             |                  |
   |                           |-- add job ------------>|             |                  |
   |<-- 202 { jobId } ---------|                        |             |                  |
   |                           |                        |-- job ----->|                  |
   |   (spinner showing)       |                        |             |-- get hotels --->|
   |                           |                        |             |<-- real data ----|
   |                           |                        |             |                  |
   |                           |                        |             |-- prompt+data -->[OpenAI]
   |                           |                        |             |<-- plan w/ H1 ---|
   |                           |                        |             |                  |
   |                           |                        |             | verify H1 exists |
   |                           |                        |             |-- save --------->|
   |                           |                        |<-- done ----|                  |
   |                           |<-- 'completed' event --|             |                  |
   |<== WebSocket push ========|                        |             |                  |
   |   (itinerary appears)     |                        |             |                  |
```

**In words:** browser asks → API queues it and replies instantly → worker fetches real data from MongoDB → sends it to OpenAI inside the prompt → checks the AI used real records → saves → pushes the result back over WebSocket.

**Backup plan:** if the WebSocket is broken, the browser polls `GET /trips/generate/:jobId` every 5 seconds instead. If nothing arrives in 90 seconds it shows a timeout with a retry button.

---

## Folder structure

```
backend/src/
├── server.js              Starts everything. Read this first.
│
├── ai/                    ← Everything that talks to OpenAI
│   ├── openai.js             The only file that calls the API
│   ├── prompts.js            The actual text we send
│   ├── schemas.js            The JSON shape we demand back
│   └── mockData.js           Fake data when there's no API key
│
├── config/                db.js (MongoDB), redis.js (queue settings)
├── constants/             Shared values (enums, event names, emergency numbers)
├── controllers/           Handle HTTP req/res. No business logic.
├── middlewares/           errorHandler, auth, rateLimit
├── models/                8 Mongoose schemas
├── repositories/          Database queries for Trip/Itinerary
├── routes/                URL -> controller mapping
├── services/              ← The actual business logic
├── socket/                WebSocket setup
├── utils/                 AppError
└── workers/               The background job processor

frontend/src/
├── App.jsx                Main page + all state
├── components/            10 components
├── constants/             Mirrors backend enums
├── utils/identity.js      Guest ID + JWT storage
└── config.js              API URL
```

---

## Every file, one line each

### The 6 files that matter most — know these cold

| File | What it does |
|---|---|
| `workers/aiGenerator.worker.js` | **The heart.** 4 steps: fetch data → ask AI → verify → save |
| `services/inventoryCatalog.service.js` | Pulls real hotels from MongoDB, labels them H1/R1/P1 |
| `seed/seed.js` | Builds the 12,420-record dataset. `--dry-run` needs no database |
| `seed/generators.js` | Turns one destination into hotels/restaurants/places/flights |
| `seed/data/india.js`, `world.js` | 171 real destinations: coords, airports, sights, dishes |
| `services/itineraryGrounding.service.js` | Checks the AI used real codes. Rejects invented ones |
| `ai/openai.js` | The only file that calls OpenAI. Retries, validates, logs cost |
| `services/queueListener.service.js` | When a job finishes, pushes it to that user's browser |
| `services/ai.service.js` | Validates the request, puts the job in the queue |

### Everything else

| File | What it does |
|---|---|
| `server.js` | Creates the Express app, connects DB, starts socket + worker |
| `ai/prompts.js` | The text sent to OpenAI, for both prompts |
| `ai/schemas.js` | Zod schemas + JSON Schema so OpenAI can't return the wrong shape |
| `ai/mockData.js` | Placeholder data when `OPENAI_API_KEY` is missing |
| `config/db.js` | Connects to MongoDB |
| `config/redis.js` | Redis connection + queue name, in one place |
| `constants/travelProfile.js` | The enums: budget tiers, traveller types, interests, food prefs |
| `constants/socketEvents.js` | WebSocket event names + user ID validation |
| `constants/emergencyNumbers.js` | Verified emergency numbers for 16 countries |
| `controllers/trip.controller.js` | `POST /generate`, `GET /generate/:jobId` |
| `controllers/travel.controller.js` | Hotel/restaurant/place/flight search endpoints |
| `middlewares/errorHandler.js` | Catches all errors, hides stack traces in production |
| `middlewares/auth.js` | Resolves `req.userId` from a verified JWT, or a `guest_` header |
| `middlewares/rateLimit.js` | Fixed-window limiter, used on login and register |
| `utils/jwt.js` | Signs and verifies tokens; fails at boot if `JWT_SECRET` is weak |
| `services/auth.service.js` | Register, login, /me — and the anti-enumeration choices |
| `controllers/auth.controller.js`, `routes/auth.routes.js` | HTTP layer for auth |
| `models/Hotel/Restaurant/TouristPlace/Flight` | The travel inventory |
| `models/Destination.js` | City info + 360° VR image |
| `models/DestinationIntelligence.js` | Cached 18-category AI briefing |
| `models/Itinerary.js` | The generated plan |
| `models/Trip.js`, `models/User.js` | Trip metadata; user account with bcrypt hashing |
| `repositories/trip.repository.js` | Saves the generated itinerary |
| `routes/*.routes.js` | URL → controller |
| `services/trip.service.js` | Trip create/read logic |
| `services/destinationIntelligence.service.js` | Cache-or-generate the city briefing |
| `socket/index.js` | Socket.io setup, per-user rooms |
| `utils/AppError.js` | Custom error class with HTTP status codes |

---

## Database collections

| Collection | Holds | Notes |
|---|---|---|
| `hotels` | 2,394 hotels with price, rating, coords | `citySlug + rating`, `citySlug + price` |
| `restaurants` | 2,736 restaurants, cuisine, signature dishes | `citySlug + rating`, `citySlug + cuisine` |
| `touristplaces` | 2,049 attractions, category, duration | `citySlug + rating`, `citySlug + category` |
| `flights` | 5,070 routes with airline, time, price | `fromSlug + toSlug + price` |
| `destinations` | 171 cities across 38 countries | `citySlug` unique, `country + priceTier` |
| `destinationintelligences` | **Cached** 18-category AI briefing | 90-day TTL |
| `itineraries` | Generated plans | |
| `trips` | Trip metadata | |
| `users` | Accounts | email (unique), bcrypt passwordHash (`select: false`) |

---

## Known gaps — say these before the interviewer finds them

Being upfront about limitations reads as senior. Being caught out doesn't.

| Gap | The honest answer |
|---|---|
| **Token in localStorage** | "It's readable by any script on the page, so an XSS bug becomes account takeover. The fix is an httpOnly cookie plus a refresh token — I chose the simpler option deliberately and can explain the tradeoff." |
| **Worker runs in the API process** | "Yes — that's the first thing I'd fix to scale. Right now a slow AI call competes with HTTP handling on the same event loop. The fix is a separate worker container." |
| **No Socket.io Redis adapter** | "It works on one server. With two servers behind a load balancer the push would only reach clients on the emitting instance. Redis adapter is a two-line fix." |
| **Flights have no date** | "They're route templates, not dated instances. The user picks a date and it's currently ignored in search. Adding a date dimension is the next data change." |
| **Filter sidebar doesn't work** | "It's UI only — I disabled it rather than fake it." *(Do this if you haven't yet.)* |
| **No tests committed** | "I tested manually and with throwaway scripts. Proper suite is the next thing." |
| **Bookings aren't real** | "It generates a reference number but doesn't persist or take payment. It's a demo of the flow." |

---

## The 60-second explanation

Practice until it's natural:

> "Velora is an AI travel planner. The interesting part isn't that it calls OpenAI — everyone does that. It's that the AI is grounded in my own database.
>
> When you request a trip, I first query MongoDB for real hotels, restaurants and attractions in that city, filtered to your budget. I label them H1, R1, P1 and put that list inside the prompt, telling the model to pick from it and reference by code. Then I verify every code it returned actually exists — if it invented one, the job fails rather than showing a fake hotel.
>
> Because generation takes 30 seconds, it runs as a background job through BullMQ on Redis. The API returns 202 immediately with a job ID, and the result gets pushed back over Socket.io when the worker finishes. There's a polling fallback if the WebSocket drops.
>
> The plan also adapts — solo versus family changes which venues are suitable, budget tier filters the catalogue before the AI ever sees it, and dietary preferences are hard constraints."
