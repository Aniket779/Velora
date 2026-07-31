# Velora — AI Travel Planner

An AI travel planner that builds day-by-day itineraries from **real inventory in a database**, not invented places.

Most AI travel apps forward a prompt to an LLM and get back plausible-sounding hotels that don't exist. Velora queries MongoDB first, puts the real hotels and restaurants **into** the prompt, and then verifies the AI actually used them — rejecting the plan if it invents anything.

```
React + Vite  ·  Node + Express  ·  MongoDB  ·  Redis + BullMQ  ·  Socket.io  ·  OpenAI
```

---

## What it does

- **Grounded AI itineraries** — the model selects from real database records, never invents venues
- **Adapts to the traveller** — days, budget, solo/couple/family/group, interests, adventure level, food preferences, pace
- **18-category destination briefings** — history, culture, food, festivals, hidden gems, transport, shopping, weather, safety, scams, emergency numbers, etiquette, budgets, packing
- **171 destinations, 38 countries** — Indian metros, hill stations, beaches, deserts, pilgrimage sites, wildlife parks and UNESCO sites, plus Europe, USA, Japan, China, Southeast Asia, UAE, Australia and South America
- **Live updates** — generation runs as a background job; results push to the browser over WebSocket
- **360° VR previews** and interactive maps for destinations

## The dataset

| Collection | Records | Notes |
|---|---:|---|
| Destinations | 171 | Real cities, coordinates, IATA codes, attractions, dishes |
| Hotels | 2,394 | 14 per city, budget → luxury, priced by destination tier |
| Restaurants | 2,736 | 16 per city, regional cuisine + signature dishes |
| Attractions | 2,049 | Curated real sights first, then city-specific activities |
| Flights | 5,070 | 10 hub cities, fares scaled by great-circle distance |
| **Total** | **12,420** | Generated in ~130 ms, fully deterministic |

**On data provenance — say this plainly if asked.** The *destinations* are factual: real
cities, real coordinates, real airport codes, real attractions, real regional dishes. The
*businesses* are procedurally generated — hotel names, prices, ratings and flight numbers
are synthetic but realistic, scaled by a per-destination price tier. This is normal for a
portfolio project, but it is synthetic seed data, not scraped live inventory.

Regenerating is deterministic: the same destination always produces the same records, so
re-seeding never silently changes app behaviour.

```bash
npm run seed                      # full dataset
node seed/seed.js --dry-run       # inspect output, no database needed
node seed/seed.js --only=india    # Indian destinations only
```

---

## Screenshots

> _Add 3–4 screenshots here: the search form, a generated itinerary, the destination guide, the VR viewer._

| | |
|---|---|
| ![Search](docs/screenshots/search.png) | ![Itinerary](docs/screenshots/itinerary.png) |
| ![Guide](docs/screenshots/guide.png) | ![Map](docs/screenshots/map.png) |

---

## How it works

The interesting part is the generation pipeline:

```
1. FETCH      Query MongoDB for hotels, restaurants, attractions, flights
              in that city, filtered to the user's budget tier
                                  ↓
2. LABEL      Assign short codes:  H1 Taj Exotica  ·  R1 Gunpowder  ·  P1 Fort Aguada
                                  ↓
3. GENERATE   Put that catalogue inside the prompt.
              "Pick from this list. Reference by code."
                                  ↓
4. VERIFY     Look up every code the AI returned.
              Invented a code? → reject the plan, fail the job.
              Under 50% grounded? → reject.
                                  ↓
5. DELIVER    Save to MongoDB, push to the browser over Socket.io
```

Because generation takes 20–40 seconds, it runs as a **BullMQ job on Redis**. The API returns `202 Accepted` with a job ID immediately; the worker does the slow part. The browser gets the result over WebSocket, with a polling fallback if the socket drops.

Full detail: **[ARCHITECTURE.md](ARCHITECTURE.md)**

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19, Vite | Fast dev loop |
| Backend | Node, Express | |
| Database | MongoDB + Mongoose | Itineraries are deeply nested documents — one read instead of four joins |
| Queue | BullMQ + Redis | AI calls are too slow for a request cycle; jobs survive restarts |
| Realtime | Socket.io | Push results without polling |
| AI | OpenAI GPT-4o, structured outputs | Schema-constrained output means malformed JSON is impossible |
| Validation | Zod | One schema definition drives both the OpenAI contract and runtime checks |
| Maps / VR | Leaflet, Pannellum | |

---

## Getting started

### Prerequisites

- Node 18+
- Docker (for MongoDB and Redis)
- An OpenAI API key *(optional — the app runs with placeholder data without one)*

### Setup

```bash
# 1. Start MongoDB and Redis
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env      # then add your keys
npm run seed              # populate travel inventory
npm run dev               # http://localhost:5000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

### Environment variables

`backend/.env`:

```bash
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/Velora

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# REDIS_PASSWORD=          # set for Upstash / managed Redis (enables TLS)

OPENAI_API_KEY=sk-...      # optional; without it you get placeholder content
OPENAI_MODEL=gpt-4o-2024-08-06

CLIENT_URL=http://localhost:5173
```

`frontend/.env`:

```bash
VITE_API_URL=http://localhost:5000
```

> **Without an `OPENAI_API_KEY`** the app runs end-to-end using clearly-labelled placeholder content, so you can explore the full flow without spending anything.

---

## Project structure

```
backend/src/
├── ai/              OpenAI client, prompts, schemas, mock data
├── config/          Database and Redis connections
├── constants/       Shared enums and verified data
├── controllers/     HTTP request handlers
├── middlewares/     Error handling, identity
├── models/          Mongoose schemas
├── repositories/    Database queries
├── routes/          URL → controller
├── services/        Business logic
├── socket/          WebSocket setup
└── workers/         Background job processor

frontend/src/
├── components/      UI components
├── constants/       Mirrors backend enums
└── utils/
```

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/trips/generate` | Start generation. Returns `202` + `jobId` |
| `GET` | `/api/v1/trips/generate/:jobId` | Poll job status (WebSocket fallback) |
| `GET` | `/api/hotels?city=Goa` | Search hotels |
| `GET` | `/api/restaurants?city=Goa` | Search restaurants |
| `GET` | `/api/places?city=Goa` | Search attractions |
| `GET` | `/api/flights?from=Delhi&to=Goa` | Search flights |
| `GET` | `/health` | Health check |

**WebSocket events:** `itinerary_generated`, `itinerary_generation_failed`, `room_joined`

---

## Design decisions worth calling out

**Budget filtering happens in the database query, not the prompt.**
Telling a model "prefer cheaper options" still surfaces the expensive one sometimes. Filtering the catalogue before the model sees it makes that impossible.

**Emergency numbers are curated, not generated.**
A hallucinated emergency number could cause real harm, so a verified registry overrides model output. Countries not in the registry are flagged as unverified in the UI.

**Grounding is verified, not requested.**
The prompt asks the model to use the catalogue. A separate service checks that it did. Without that check the rule is just a suggestion, and the failure is silent.

**The destination briefing is cached for 90 days.**
Goa's history doesn't change between users. Only the itinerary is generated per request.

---

## Known limitations

Honest about where this stands:

- **No authentication yet** — identity is a request header; the structure is in place for JWT
- **Worker runs in the API process** — should be a separate container to scale independently
- **No Socket.io Redis adapter** — works on one server, needs the adapter for multiple
- **Bookings are simulated** — generates a reference, no persistence or payment
- **No automated test suite** — tested manually and with throwaway scripts

---

## Roadmap

- [ ] JWT authentication
- [ ] Separate worker process
- [ ] Test suite + CI
- [ ] Real booking persistence and payments
- [ ] Geographic day-clustering using `2dsphere` indexes
- [ ] Conversational refinement ("make day 2 more relaxed")

---

## License

MIT
