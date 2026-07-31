# Velora — Implementation Roadmap

**Author:** Lead Engineer
**Date:** 30 July 2026
**Source of truth:** `ENGINEERING_REVIEW.md` (same directory)
**Status:** Plan only. No code has been written.

---

## How to read this document

18 milestones, **M0 → M17**, in the exact order I would ship them. Each is independently completable and independently demoable. None are merged.

**Complexity scale**

| Label | Meaning | Rough effort |
|---|---|---|
| Trivial | Mechanical, no design decisions | < 2 h |
| Low | Contained, one or two files, obvious approach | 0.5–1 d |
| Medium | Multiple files, some design judgment | 2–4 d |
| High | Cross-cutting, touches both tiers, migration risk | 5–10 d |
| Very High | New subsystem, needs a design doc first | 10 d+ |

**Estimates assume one engineer** working with reasonable focus. They are effort, not calendar time.

---

## Sequencing rationale — the calls I made

Before the milestones, the four ordering decisions that aren't obvious, and why I made them the way I did. Push back on any of these before we start.

**1. Repo hygiene (M0) goes before the critical pipeline fix (M1).**
It feels wrong to spend a day on a README when the AI pipeline is broken. But you cannot verify M1 without seed data in Mongo, and the existing seeder covered only 20 destinations (since expanded to 171). You cannot verify a fix you can't run. M0 is the prerequisite for *proving* every milestone that follows.

**2. API contract unification (M5) goes before authentication (M6).**
Auth adds middleware to every route. Unification deletes an entire router and collapses five surfaces into one. Doing auth first means applying it to routes we're about to delete, then re-applying it. Unify first, authenticate once.

**3. Request validation (M6) goes before auth (M7).**
Auth introduces `/register` and `/login` — the two endpoints where inbound validation matters most. Building the validation layer first means those endpoints get it on day one instead of as a retrofit.

**4. AI grounding (M12) is deliberately late, and this is the call most likely to be wrong.**
Grounding the model in real inventory is the single biggest product and résumé win in the whole report (§8.3 Tier 1). Every instinct says do it early. I've put it at M12 because it rewrites the worker end-to-end, and doing that before the worker has moved to its own process (M10), before the data model is stable (M8), and before there are tests (M11) means doing it twice.

**If you need a demo sooner than M12 allows** — an interview, a deadline — say so now. I would then pull a thin version of grounding forward to sit right after M1, accept that it gets partially rewritten at M10, and treat that rework as a deliberate cost. That is a legitimate trade; it just needs to be a decision rather than an accident.

**On "correctness before features":** M0–M11 contain almost no new user-facing functionality. That is intentional and it is what you asked for. The first genuinely new feature ships at M12. If that stretch feels too long without visible progress, M2 and M13 are the two milestones with the most visible payoff and can be moved earlier at low cost.

---

## Milestone map

| # | Milestone | Complexity | Depends on |
|---|---|---|---|
| M0 | Runnable Baseline & Repo Hygiene | Low | — |
| M1 | Restore the Async Generation Pipeline | Medium | M0 |
| M2 | Truthful UI & Honest Error States | Low | M1 |
| M3 | Security Hardening (Pre-Auth) | Low | M0 |
| M4 | Observability Foundation | Medium | M0 |
| M5 | API Contract Unification | Medium | M1, M4 |
| M6 | Request Validation Layer | Medium | M5 |
| M7 | Authentication & Identity | High | M5, M6 |
| M8 | Domain Data Model Correctness | High | M7 |
| M9 | Query Performance & Index Correctness | Medium | M8 |
| M10 | Worker Extraction & Queue Hardening | High | M1, M4 |
| M11 | Automated Testing & CI | High | M5, M7, M8 |
| M12 | AI Grounding & Structured Outputs | High | M8, M9, M10, M11 |
| M13 | Frontend Architecture Refactor | High | M5, M7 |
| M14 | Accessibility & Responsive Compliance | Medium | M13 |
| M15 | Caching & Performance | Medium | M9, M10 |
| M16 | Feature Completion | High | M12, M13 |
| M17 | Advanced Product Capabilities | Very High | M16 |

---

# M0 — Runnable Baseline & Repo Hygiene

### Goal
Make the repository clonable, startable, and seedable by someone who has never seen it, and remove every piece of code that isn't doing work. Install a test harness — harness only, not a suite.

### Why it matters
Two findings from the review converge here: there is no `.env.example`, and there is no root README. (A third claim in that review — that `seed/` did not exist — was **wrong**; see Correction #2 in ENGINEERING_REVIEW.md. A working seeder was present, covering 20 destinations. It has since been expanded to 171.) More importantly for the milestones below — **every subsequent fix needs a populated database to verify against.**

Dead code is included here rather than deferred because it is cheap now and gets more expensive later: every refactor from M5 onward would otherwise carry `AIGeneratorForm.jsx` and `App.css` along with it.

### Features
- Root `README.md`: what Velora is, architecture diagram, prerequisites, setup, env vars, run commands, seed instructions, known limitations
- `backend/.env.example` with every required key documented and no values
- Boot-time environment validation — the process fails loudly and immediately on a missing required var rather than silently degrading to mock data (§3.7)
- Expand `backend/seed/seed.js` beyond its original 20 destinations so every query path has realistic volume (DONE — now 171 destinations, 12,420 records)
- Resolve the Mongo database name casing conflict — `config/db.js` defaults to `Velora`, `temp-query.js` uses `velora`, and Mongo database names are case-sensitive (§Appendix)
- Delete all dead code identified in §3.2
- Test harness installed (Vitest or Jest) with a single smoke test that boots the app and hits `/health`. **Harness only — the suite is M11.**
- Fix `frontend/index.html` `<title>`, add meta description
- Enforce ESLint in the backend (currently frontend-only) and fix the unused-import violations

### Files that will change

**Created**
- `README.md`
- `backend/.env.example`
- `backend/src/config/env.js` — validated config object
- `backend/seed/seed.js`, `backend/seed/generators.js`, `backend/seed/pools.js`, `backend/seed/data/*.js`
- `backend/vitest.config.js`, `backend/tests/smoke.test.js`
- `backend/.eslintrc.json`

**Deleted**
- `backend/temp-query.js`
- `frontend/src/App.css`
- `frontend/src/components/AIGeneratorForm.jsx`
- `frontend/src/assets/hero.png`, `react.svg`, `vite.svg`

**Modified**
- `backend/package.json` — seed + test scripts, dev dependencies
- `backend/src/config/db.js` — consume validated config, add pool/timeout options
- `backend/src/server.js` — remove unused `mongoose` import, load env config first
- `frontend/index.html`
- `frontend/src/App.jsx`, `components/ItineraryDisplay.jsx`, `components/FlightBooking.jsx`, `components/FloatingAIAssistant.jsx` — remove unused imports

### Estimated complexity
**Low** — 2–3 days, most of it seed data authoring.

### Dependencies
None. This is the entry point.

### Acceptance criteria
1. A fresh `git clone` followed by the documented steps produces a running frontend and backend with zero manual file edits beyond copying `.env.example` to `.env` and adding secrets.
2. `docker compose up` then `npm run seed` populates all five inventory collections; a smoke query for hotels in Goa returns non-empty.
3. Starting the backend with a required env var missing exits non-zero within 2 seconds with a message naming the missing variable.
4. `npm test` runs and the smoke test passes.
5. `npm run lint` passes clean in both `backend/` and `frontend/`.
6. Grepping the repo for `AIGeneratorForm`, `App.css`, `temp-query`, `hero.png` returns zero hits.
7. A person who has not seen the project can start it from the README alone, unaided. **Test this with an actual person.**

---

# M1 — Restore the Async Generation Pipeline

### Goal
Make the BullMQ → worker → OpenAI → Zod → QueueEvents → Socket.io → browser path the *only* path that produces an itinerary, and make it work end to end.

### Why it matters
This is the most important milestone in the document. Per §1.4, the architecture Velora advertises is currently decorative: the client fires the job, swallows the error, and builds the itinerary itself in a `for`-loop (`App.jsx:71–111`). Even if it waited, nothing would arrive — `queueListener.service.js:32` destructures `returnvalue` as an object when BullMQ delivers a string, so the socket emit never fires.

Everything downstream depends on this. There is no point hardening a queue that nothing flows through, no point grounding an AI whose output never reaches the user, and no honest answer to the interview question in §10 until this is true.

### Features
- Fix `returnvalue` handling in the queue listener — parse defensively, guard against `undefined`, log and skip malformed payloads rather than throwing inside an event handler
- Emit `itinerary_generation_failed` on job failure (currently commented out at `queueListener.service.js:43`); thread `userId` through job data so the failure can be routed to the right room
- Delete `buildStructuredItinerary` from `App.jsx` and every call site
- Rework `handleStartAIGeneration` to await the 202, store the returned `jobId`, and render only on a socket event
- **Correlate socket events to the requesting job by `jobId`** — without this, a late-arriving event from an abandoned request overwrites the current view (§1.4, unguarded race)
- Client-side generation timeout (suggest 90 s) with an explicit timeout state and a retry affordance
- Surface real backend errors instead of `console.warn` (`App.jsx:127`)
- A `GET /api/v1/jobs/:jobId` polling fallback for when the socket is unavailable

### Files that will change

**Backend**
- `src/services/queueListener.service.js` — the core fix; parsing, guards, failure emit
- `src/workers/aiGenerator.worker.js` — ensure the return payload shape is explicit and documented
- `src/services/ai.service.js` — return `jobId` in a stable shape
- `src/api/controllers/trip.controller.js` — return `jobId` to the client
- `src/api/routes/trip.routes.js` — add the job-status route
- `src/socket/index.js` — room join confirmation ack

**Frontend**
- `src/App.jsx` — delete `buildStructuredItinerary`, rewrite `handleStartAIGeneration`, add `jobId` correlation, timeout, error surfacing
- `src/components/ItineraryDisplay.jsx` — accept the backend payload shape as canonical

**Tests**
- `backend/tests/integration/generation-pipeline.test.js`

### Estimated complexity
**Medium** — 3–4 days.

The listener fix itself is 30 minutes. The remaining time is the frontend rework and, above all, **verification**: this path has never demonstrably worked, so budget real time for discovering second-order breakage once jobs actually complete. Expect at least one surprise in the worker's save path (`trip.repository.js:41`, where `isValidObjectId` is always false in this flow — see M8).

### Dependencies
**M0** — needs seed data and a working local Redis/Mongo to verify against.

### Acceptance criteria
1. Clicking "Generate AI Itinerary" produces an itinerary that came from the backend worker. Verified by killing the worker process: the request must time out with a visible error, **not** silently render a client-built itinerary.
2. Setting `OPENAI_API_KEY` to an invalid value causes the job to fail, the client receives `itinerary_generation_failed`, and a clear error renders. No infinite spinner.
3. Stopping Redis produces an immediate, explicit "generation service unavailable" error at request time.
4. Two generations fired in quick succession: only the itinerary matching the most recent `jobId` renders. The stale one is discarded.
5. A generation exceeding 90 seconds shows a timeout state with a working retry.
6. Integration test covers: happy path, worker failure, malformed `returnvalue`, and timeout.
7. `grep -r "buildStructuredItinerary" frontend/` returns nothing.

---

# M2 — Truthful UI & Honest Error States

### Goal
Eliminate every place the interface asserts something untrue: fake booking confirmations, non-functional filters, and controls styled by CSS classes that don't exist.

### Why it matters
`BookingModal.jsx:22–31` catches an API failure and **fabricates a successful booking with a fake reference number.** The user is told a reservation exists when nothing was persisted anywhere. That is the most user-hostile behaviour in the codebase and, per §10, the one an interviewer would judge most harshly.

The filter sidebar is the same category of problem in a milder form — eleven checkboxes rendered `defaultChecked` with no `onChange` (`App.jsx:210–235`). Clicking them does nothing. And two CSS classes used across nine call sites, `.btn-secondary` and `.spin`, are **defined nowhere**, so those buttons render unstyled and the AI loading spinner does not rotate.

I am scheduling *removal* of fake functionality here and *implementation* of real functionality at M16. Shipping an honest gap beats shipping a dishonest feature, and it costs a tenth as much.

### Features
- Remove the fabricated-success fallback in `BookingModal`; show a real error with retry
- Disable the filter sidebar behind a "Filters coming soon" state, or remove it. **Do not leave inert controls that respond to clicks.** (Real filters ship in M16.)
- Add the missing `.btn-secondary` and `.spin` CSS, including the `spin` keyframe
- Fix the three invalid inline style properties silently dropped by React: `justifyBetween` (App.jsx:201,302; HotelBooking.jsx:21), `justifyCenter` (FlightBooking.jsx:18), `items` (BookingModal.jsx:69)
- React error boundary at the app root
- Distinguish "no results" from "request failed" in every list view — currently both render as an empty list with a count of 0
- Retry affordance on every failed fetch
- Null-guard `flight.price.toLocaleString()` (FlightBooking.jsx:53) and the equivalent unguarded accesses
- Unify empty-state copy to one voice
- Fix the shared `viewMode` state driving two independent map/list toggles (ItineraryDisplay.jsx:22)

### Files that will change
- `frontend/src/components/BookingModal.jsx`
- `frontend/src/App.jsx` — filter sidebar, error states
- `frontend/src/index.css` — `.btn-secondary`, `.spin`, `@keyframes spin`
- `frontend/src/components/FlightBooking.jsx`, `HotelBooking.jsx`, `CabBooking.jsx`
- `frontend/src/components/ItineraryDisplay.jsx` — split `viewMode`, unify empty states
- **Created:** `frontend/src/components/ErrorBoundary.jsx`, `frontend/src/components/EmptyState.jsx`, `frontend/src/components/ErrorState.jsx`

### Estimated complexity
**Low** — 2 days. Almost entirely mechanical; the error boundary is the only design decision.

### Dependencies
**M1** — error states should reflect the real pipeline's failure modes, not the bypassed one.

### Acceptance criteria
1. With the backend stopped, clicking "Confirm & Pay" shows a failure message. No reference number is displayed under any failure condition.
2. No interactive control exists that produces no effect. Every checkbox, button, and toggle either works or is visibly disabled with an explanation.
3. The AI generation spinner visibly rotates.
4. `grep -rn "justifyBetween\|justifyCenter\|items: '" frontend/src/` returns zero hits.
5. Every CSS class referenced in JSX resolves to a definition — verified by a script, not by eye.
6. A deliberately thrown render error in `ItineraryDisplay` shows the error boundary, not a blank page.
7. Backend stopped: every list shows a distinct "couldn't load" state with a retry button, never "Available Flights (0)".
8. Switching Hotels to map view leaves Sightseeing in list view.

---

# M3 — Security Hardening (Pre-Auth)

### Goal
Close every security hole that does not require an identity system, before the app is exposed anywhere.

### Why it matters
Four findings from §3.7 are exploitable today and none need auth to fix. `app.use(cors())` allows every origin (server.js:25). `services.routes.js:120` accepts a client-supplied `amount` and confirms it — trivial price tampering. `services.routes.js:49–50,86` builds regexes from unescaped user input, a ReDoS vector that `travel.controller` correctly avoids. And `/trips/generate` enqueues a paid OpenAI call with no rate limit, which is a direct financial DoS.

This lands before auth because it is cheap, independent, and because deploying anything publicly before it is done would be negligent.

### Features
- CORS allowlist driven by config; align HTTP and Socket.io policies (currently inconsistent — Socket.io restricts, HTTP doesn't)
- `helmet` with a sensible CSP
- `express-rate-limit`: global limit, plus a strict per-IP limit on `/trips/generate`. Upgraded to per-user quotas in M7.
- Escape regex input in `services.routes.js`, or delete its data access entirely if M5 is pulled forward
- Explicit body size limits on `express.json()`
- `express-mongo-sanitize` as defence in depth against operator injection
- **Server-side price derivation at booking** — look the item up by `id` and use *its* stored price; never trust `req.body.amount`
- Mongo authentication in `docker-compose.yml`; stop publishing 27017 unauthenticated
- Redis persistence volume in compose (currently none — queue state is lost on restart)
- Add `compression`

### Files that will change
- `backend/src/server.js` — helmet, cors, rate limit, body limits, sanitize, compression
- `backend/src/api/routes/services.routes.js` — regex escaping, server-side pricing
- `backend/src/config/env.js` — allowlist config
- `docker-compose.yml` — Mongo auth, Redis volume, healthchecks
- **Created:** `backend/src/api/middlewares/rateLimit.js`, `backend/src/config/cors.js`

### Estimated complexity
**Low** — 1–2 days. CSP tuning against the Unsplash/Leaflet/Pannellum external assets is the only fiddly part.

### Dependencies
**M0** — needs the validated config module.

### Acceptance criteria
1. A cross-origin request from a non-allowlisted origin is rejected by both HTTP and Socket.io.
2. `POST /services/book` with `amount: 1` for a ₹50,000 flight returns the flight's real price or a 400. It never confirms at the submitted amount.
3. `helmet` headers present on every response; `X-Powered-By` absent.
4. 100 rapid requests to `/trips/generate` from one IP: the excess is rejected with 429.
5. A pathological regex payload in `?from=` returns promptly. Measured, not assumed.
6. `docker compose up` starts Mongo with auth required; an unauthenticated connection is refused.
7. Redis queue state survives a container restart.
8. A dependency audit (`npm audit`) shows no high or critical advisories.

---

# M4 — Observability Foundation

### Goal
Replace 28 `console.*` calls across 10 backend files with structured logging, and make a single user action traceable across the HTTP → queue → worker → socket boundary.

### Why it matters
Every milestone after this one gets debugged using what we build here. That is the whole argument for its position: M1 was painful to verify precisely because the only instrumentation was `console.log`, and M10–M12 involve a distributed boundary that is effectively undebuggable without correlation IDs.

Per §6, the existing `[Worker]` / `[QueueListener]` prefixes show the right instinct. We're formalising it.

### Features
- `pino` with per-module child loggers and environment-appropriate levels
- Request ID middleware — generate or accept `X-Request-Id`, attach to `req`, echo in responses
- **Propagate the request ID into BullMQ job data**, through the worker, and onto the socket emit. This is the piece that makes the distributed flow legible.
- Explicit redaction of secrets, tokens, and PII in log output
- Expand `errorHandler` to classify Mongoose `CastError`, `ValidationError`, and E11000 duplicate-key into correct status codes instead of opaque 500s (§3.6)
- Extend `AppError` with a machine-readable `code` so clients can branch on codes, not message strings
- `process.on('unhandledRejection')` and `('uncaughtException')` handlers that log and exit deliberately
- Graceful shutdown: SIGTERM → stop accepting connections → drain in-flight jobs → close Mongo and Redis → exit
- Replace `process.exit(1)` in `config/db.js:10` with bounded retry and exponential backoff
- Sentry (or equivalent) wired to both tiers
- `/health` extended to a real readiness probe reporting Mongo and Redis status

### Files that will change
- **Created:** `backend/src/utils/logger.js`, `backend/src/api/middlewares/requestId.js`, `backend/src/utils/shutdown.js`
- `backend/src/server.js` — logger, request ID, shutdown, process handlers, readiness
- `backend/src/utils/AppError.js` — error codes
- `backend/src/api/middlewares/errorHandler.js` — error taxonomy
- `backend/src/config/db.js` — retry instead of exit
- All 10 files containing `console.*`: `socket/index.js`, `workers/aiGenerator.worker.js`, `services/{queueListener,ai,travelDataFetcher}.service.js`, `integrators/ai.integrator.js`, `api/routes/services.routes.js`, `api/middlewares/errorHandler.js`, `config/db.js`
- `frontend/src/main.jsx` — Sentry init

### Estimated complexity
**Medium** — 3–4 days. Request-ID propagation across the queue boundary is the non-trivial part.

### Dependencies
**M0** — config module.

### Acceptance criteria
1. Zero `console.*` calls remain in `backend/src`. Enforced by an ESLint rule, not by review.
2. A single itinerary generation produces log lines sharing one request ID across the API process, the worker, and the socket emit. Demonstrated by grepping one ID and reading the full story.
3. `GET /trips/:id` with a malformed ObjectId returns 400 with a specific error code, not 500.
4. A duplicate email insert returns 409, not 500.
5. SIGTERM during an in-flight job: the process waits for completion (up to a bounded timeout), closes connections cleanly, exits 0. No stalled BullMQ jobs.
6. Mongo unavailable at boot: the process retries with backoff and logs each attempt rather than exiting immediately.
7. `/health` returns 503 when Mongo or Redis is down, 200 otherwise.
8. An induced unhandled rejection is logged with a stack trace before exit.
9. Logs contain no secrets — verified against a run with real credentials configured.

---

# M5 — API Contract Unification

### Goal
Collapse five API surfaces, three response envelopes, and two duplicate mounts into one coherent, versioned contract. Give the frontend a single configurable API client.

### Why it matters
Per §1.8, `travelRoutes` is mounted twice (server.js:34–35), so every inventory endpoint has two live URLs. `/api/hotels` and `/api/v1/services/hotels` query the **same collection and return different shapes** — which is why `ItineraryDisplay.jsx` is littered with `hotel.hotelName || hotel.name` and `flight.departureTime || flight.departure`. That defensive coding is pure interest payment on the contract inconsistency.

Separately, `http://localhost:5000` is hardcoded in 12 places. **The frontend cannot be deployed at all today.**

This lands before auth so that auth middleware is applied once, to a clean surface.

### Features
- One envelope for every endpoint: `{ success, data, pagination?, error? }`
- Delete all data access from `services.routes.js`; serve inventory exclusively from `travel.controller` (removes duplication D7 from §3.1)
- Remove the duplicate `/api` mount; standardise on `/api/v1` with a deprecation shim on `/api` for one release
- Move `MOCK_CABS` out of route code into a seeded `Cab` collection or an explicit fixtures module
- Frontend API client module with `import.meta.env.VITE_API_URL`
- Replace all 12 hardcoded URLs, including the Socket.io connection
- Vite dev proxy so local development is same-origin
- Extract the shared backend utilities duplicated across files (§3.1 D1–D6): `config/redis.js`, `utils/regex.js`, `utils/pagination.js`, and a generic `_paginatedFind(Model, filter, sort, opts)` replacing the four near-identical `_fetchX` methods
- Remove the `|| ` fallback chains in the frontend once shapes are canonical
- OpenAPI 3 spec, served at `/api/docs`

### Files that will change

**Backend**
- `src/server.js` — mounts, deprecation shim, docs route
- `src/api/routes/services.routes.js` — reduced to booking only; **renamed** to `booking.routes.js` (per §3.3, "services" collides with the `services/` layer)
- `src/api/routes/travel.routes.js`, `trip.routes.js`
- `src/api/controllers/travel.controller.js` — single envelope, use shared utils
- `src/services/travelDataFetcher.service.js` — generic paginated find
- **Created:** `src/config/redis.js`, `src/utils/regex.js`, `src/utils/pagination.js`, `src/api/responses.js`, `src/docs/openapi.yaml`

**Frontend**
- **Created:** `src/api/client.js`, `src/api/endpoints.js`, `.env.example`
- `src/App.jsx`, `components/BookingModal.jsx` — use the client
- `src/components/ItineraryDisplay.jsx` — remove fallback chains
- `vite.config.js` — dev proxy

### Estimated complexity
**Medium** — 4 days.

### Dependencies
**M1** (the generation flow must be settled before its contract is frozen), **M4** (structured errors inform the error envelope).

### Acceptance criteria
1. Every endpoint returns the same envelope. Verified by a contract test iterating the OpenAPI spec.
2. `grep -rn "localhost:5000" frontend/src/` returns zero hits.
3. A production build with `VITE_API_URL` pointed at a non-localhost host works end to end, Socket.io included.
4. `/api/hotels` and `/api/v1/hotels` return byte-identical bodies; `/api/*` sets a deprecation header.
5. `grep -n "hotelName || " frontend/src/` returns zero hits.
6. The Redis connection literal appears exactly once in the backend.
7. `/api/docs` renders and the spec validates.
8. `services.routes.js` no longer imports any Mongoose model.

---

# M6 — Request Validation Layer

### Goal
Validate every inbound request body, query string, and path parameter with Zod before it reaches a controller.

### Why it matters
§3.5: Zod is a backend dependency used in exactly one direction — validating what OpenAI returns. **Not one inbound request is schema-validated.** `days` could be `"abc"`, `-5`, or `10000` and flows unchecked into the prompt and the day-loop. `Number(minPrice)` on garbage yields `NaN`, producing `{$gte: NaN}`, which silently matches nothing — a filter that appears to work and returns wrong results.

Placed before auth so `/register` and `/login` — the endpoints where validation matters most — get it from day one.

### Features
- `validate(schema)` middleware factory covering `body`, `query`, `params`
- Zod schema per endpoint, colocated with routes
- Coercion and bounds on all numerics; reject rather than silently `NaN`
- Consistent 400 shape listing every field error at once, not just the first
- Backfill Mongoose schema constraints as a second line of defence (§7.2 item 8): `rating` min/max, price minimums, URL validation, `enum` on `TouristPlace.category` and `Itinerary.days.activities.type` mirroring the Zod enum
- Share the activity-type enum between the Zod and Mongoose layers from one definition
- Cap pagination in `booking.routes.js` (currently hardcoded `.limit(30)`, ignoring the client)
- Frontend form validation mirroring the server rules

### Files that will change
- **Created:** `backend/src/api/middlewares/validate.js`, `backend/src/api/schemas/{trip,travel,booking}.schema.js`, `backend/src/constants/enums.js`
- `backend/src/api/routes/*.js` — attach validators
- `backend/src/api/controllers/*.js` — drop now-redundant manual checks
- `backend/src/services/trip.service.js`, `ai.service.js` — remove ad-hoc validation
- `backend/src/models/*.js` — constraints
- `backend/src/integrators/ai.integrator.js` — import the shared enum
- `frontend/src/components/SearchWidget.jsx` — client-side mirror

### Estimated complexity
**Medium** — 3 days. Mechanical but broad.

### Dependencies
**M5** — validating a contract that's about to change is wasted work.

### Acceptance criteria
1. Every route has an attached validator. Enforced by a test that enumerates the router stack and fails on any unvalidated route.
2. `?days=abc`, `?days=-1`, `?days=99999` each return 400 with a field-level message.
3. `?minPrice=xyz` returns 400. No query ever executes with `NaN`.
4. A body with three invalid fields returns all three errors in one response.
5. Saving a `Hotel` with `rating: 99` is rejected at the model layer.
6. The activity-type enum is defined once; changing it updates both Zod and Mongoose.
7. `?limit=10000` is capped on every paginated endpoint including booking routes.

---

# M7 — Authentication & Identity

### Goal
Replace `'user_123'` and `'60d21b4667d0d8992e610c85'` with a real identity system covering HTTP, WebSocket, and the job queue.

### Why it matters
Per §3.7, this is the largest missing subsystem. There is no login, no JWT, no session, and no authorization middleware — every endpoint is public. The socket layer accepts client-asserted identity (`socket/index.js:5`) with a code comment acknowledging the gap, and because rooms are keyed `user_${userId}`, **in a multi-user deployment every user would occupy the same room and receive everyone else's itineraries.**

The `User` model has existed since the beginning and has never been imported by a single route, controller, or service. This milestone finally uses it — and unlocks per-user data, authorization, per-user rate limits, and cost attribution for everything downstream.

### Features
- Registration and login with `bcrypt` (or `argon2`) via a Mongoose `pre('save')` hook, so plaintext is structurally impossible
- JWT access tokens plus refresh-token rotation; refresh tokens in httpOnly cookies
- `authenticate` middleware populating `req.user`; `authorize(...roles)` for RBAC
- **Socket handshake JWT verification** replacing client-asserted `userId` — the data-leak fix
- Thread the authenticated user ID into BullMQ job data so the worker's completion routes to the correct room
- `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- Password reset via emailed token
- Remove every hardcoded ID: `trip.controller.js:8` and `:36`, `App.jsx:162`
- Ownership checks on Trip and Itinerary reads and writes
- Upgrade M3's IP-based rate limits to per-user quotas, including a per-user AI generation quota
- Frontend: auth context, login/register views, protected routes, token refresh interceptor, socket reconnect on token change

### Files that will change

**Backend — created**
- `src/api/routes/auth.routes.js`, `src/api/controllers/auth.controller.js`, `src/services/auth.service.js`, `src/repositories/user.repository.js`
- `src/api/middlewares/authenticate.js`, `authorize.js`
- `src/utils/jwt.js`, `src/models/RefreshToken.js`

**Backend — modified**
- `src/models/User.js` — bcrypt hook, `comparePassword`, `role`, `toJSON` stripping `passwordHash`
- `src/socket/index.js` — **replace the placeholder handshake with real JWT verification**
- `src/api/controllers/trip.controller.js` — `req.user._id` replaces both hardcoded IDs
- `src/services/ai.service.js`, `src/workers/aiGenerator.worker.js` — carry the real user ID
- `src/api/routes/*.js` — attach `authenticate`
- `src/api/middlewares/rateLimit.js` — per-user quotas
- `src/server.js` — mount auth routes, cookie parser

**Frontend — created**
- `src/context/AuthContext.jsx`, `src/hooks/useAuth.js`
- `src/pages/{Login,Register}.jsx`, `src/components/ProtectedRoute.jsx`

**Frontend — modified**
- `src/App.jsx` — remove `userId: 'user_123'`, wrap in auth provider, real routes
- `src/api/client.js` — token attach + refresh interceptor

### Estimated complexity
**High** — 8–10 days. Refresh-token rotation and socket auth are the parts most often got subtly wrong; budget for careful review.

### Dependencies
**M5** (clean route surface to protect), **M6** (auth endpoints need validation).

### Acceptance criteria
1. Register → login → authenticated request → refresh → logout all work; logout invalidates the refresh token server-side.
2. Passwords are never stored or logged in plaintext. Verified by direct database inspection.
3. `passwordHash` never appears in any API response. Verified by a test asserting on the serialized user.
4. A socket connection without a valid JWT is rejected at handshake. **A socket presenting user A's token cannot join user B's room** — this is the data-leak test and it must be explicit.
5. `grep -rn "user_123\|60d21b4667d0d8992e610c85" .` returns zero hits outside documentation.
6. User A requesting user B's trip receives 403.
7. An expired access token triggers transparent refresh; an expired refresh token forces re-login without a crash.
8. Per-user generation quota enforced; exceeding it returns 429.
9. Rate limits key on user ID when authenticated, IP otherwise.

---

# M8 — Domain Data Model Correctness

### Goal
Fix the `Itinerary.tripId` type mismatch, add the missing `Booking` collection, add ownership to itineraries, and normalise naming across schemas.

### Why it matters
Per §7.2, `Itinerary.tripId` is a `String` while `Trip._id` is an `ObjectId` — they cannot be joined or populated. `trip.repository.js:41` guards with `isValidObjectId`, which in the generate flow is **always false** (the ID is `'temp_trip_1753...'`), so the Trip is never updated and **every generated itinerary is orphaned.** The versioning pointers `originalAIVersion` and `currentVersion` are written to nothing.

Meanwhile there is no `Booking` collection at all — `/services/book` invents a reference number and persists nothing.

This lands after auth because creating a real `Trip` requires a real `owner_id`, and `Trip.owner_id` is a required ref. Without M7 we'd be inventing a system user to work around our own schema.

### Features
- `Itinerary.tripId` → `ObjectId` with `ref: 'Trip'`
- Restructure the generation flow: create the `Trip` first, pass its real `_id` into the job, link the `Itinerary` on completion
- Add `owner_id` to `Itinerary` — without it no authorization check on itinerary reads is possible
- New `Booking` model: `{ userId, serviceType, itemRef, itemType, amount, currency, status, referenceId (unique), paymentId, timestamps }`
- Persist bookings; **derive price server-side from the referenced item** (completing M3's fix with real storage)
- Replace `travelData` embedded `Mixed` copies with ObjectId references + `populate`. If a generation-time price snapshot is needed, store `{ ref, priceAtGeneration }`, not whole documents.
- Normalise naming (§7.2 item 9): `Destination.cityName` → `city`, `Trip.owner_id` → `ownerId`, `Itinerary.trip_title` → `title`, `day_number` → `dayNumber`
- Migration scripts, forward and reverse, for every schema change
- Booking history endpoints

### Files that will change
- **Created:** `backend/src/models/Booking.js`, `src/repositories/{booking,itinerary}.repository.js`, `src/services/booking.service.js`, `src/api/controllers/booking.controller.js`, `backend/migrations/00X-*.js`
- `backend/src/models/Itinerary.js` — tripId type, ownerId, travelData refs, renames
- `backend/src/models/Trip.js`, `Destination.js` — renames
- `backend/src/repositories/trip.repository.js` — remove the `isValidObjectId` workaround
- `backend/src/workers/aiGenerator.worker.js` — real trip linkage
- `backend/src/api/controllers/trip.controller.js` — create Trip before enqueue
- `backend/src/api/routes/booking.routes.js` — real persistence
- `backend/src/api/controllers/travel.controller.js` — field renames
- `backend/seed/seed.js` — regenerate for the new shapes
- `frontend/src/components/ItineraryDisplay.jsx`, `BookingModal.jsx` — renamed fields

### Estimated complexity
**High** — 7–9 days. Migrations against existing data and the `travelData` restructure carry the most risk.

### Dependencies
**M7** — needs real user IDs for `Trip.ownerId`, `Itinerary.ownerId`, and `Booking.userId`.

### Acceptance criteria
1. Generating an itinerary creates a `Trip` and an `Itinerary` where `Itinerary.tripId` is a valid ObjectId resolving to that Trip, and `Trip.currentVersion` points back. Verified by a round-trip `populate`.
2. `grep -n "isValidObjectId" backend/src/repositories/` returns nothing.
3. A booking persists a `Booking` document; the reference ID is retrievable afterward.
4. Booking amount always equals the referenced item's stored price regardless of what the client submitted.
5. `Itinerary.travelData` contains references, not embedded copies. A 14-day itinerary document is under 100 KB.
6. Migrations run forward and reverse cleanly against a seeded database.
7. No `snake_case` field names remain in any schema.
8. User A cannot read user B's itinerary.

---

# M9 — Query Performance & Index Correctness

### Goal
Make the existing indexes usable, and add the ones that are missing.

### Why it matters
§7.3 is the finding most likely to be dismissed and shouldn't be. The compound indexes on `city` are well chosen — `{city:1, rating:-1}`, `{from:1, to:1, price:1}` — but **every query bypasses them.** A `^`-anchored regex can use an index only when it is case-sensitive; the `i` flag forces Mongo to abandon index bounds and scan. So we pay for those indexes on every write and get nothing on every read. At seed-data scale this is invisible; per §9 it is the third thing to fall over at scale.

The `s?` plural variant in the current regex (matching "Goa"/"Goas") is a query-time patch for a data-quality problem. Fix it at ingest instead.

### Features
- `citySlug` on all inventory collections, set in a `pre('validate')` hook, queried by exact match
- Replace all four regex city-filter blocks (`travel.controller.js` lines 33, 78, 121, 206) with one `buildCityFilter` using exact slug match
- Normalise city data at seed/ingest so the `s?` hack is unnecessary
- Add every index in §7.4: `Trip.{ownerId, startDate}`, `Trip.{ownerId, status}`, `Trip.collaborators`, `Itinerary.{tripId, createdAt}`, `Itinerary.{ownerId, createdAt}`, `Restaurant.{citySlug, cuisine}`, `TouristPlace.{citySlug, category}`, `Booking.{userId, createdAt}`, unique `Booking.referenceId`
- **Drop the now-redundant single-field `city:1` indexes** — a compound index serves prefix queries, so standalone ones are dead weight on every write
- Replace `countDocuments()` on every paginated request with estimated counts or cursor pagination
- Cursor/keyset pagination on `{rating, _id}` for deep pages
- Tune the Mongo connection pool: explicit `maxPoolSize`, `serverSelectionTimeoutMS`
- Add an `explain()`-based test asserting index usage — this is what stops the regression recurring

### Files that will change
- `backend/src/models/{Hotel,Restaurant,TouristPlace,Flight,Destination,Trip,Itinerary,Booking}.js` — slug fields, index definitions
- `backend/src/api/controllers/travel.controller.js` — slug queries, cursor pagination
- `backend/src/services/travelDataFetcher.service.js` — same
- `backend/src/config/db.js` — pool tuning
- **Created:** `backend/src/utils/slugify.js`, `backend/migrations/00X-add-city-slugs.js`, `backend/tests/performance/index-usage.test.js`
- `backend/seed/seed.js` — populate slugs
- `frontend/src/App.jsx`, `components/SearchWidget.jsx` — stop sending `"Goa, India"`; send clean values (removes duplication D4)

### Estimated complexity
**Medium** — 4 days.

### Dependencies
**M8** — indexes should be defined against final field names, once.

### Acceptance criteria
1. `explain()` on every inventory query shows `IXSCAN`, not `COLLSCAN`. Asserted in an automated test, not checked by hand.
2. With 100k seeded hotels, a city query returns in under 50 ms p95.
3. `grep -rn "new RegExp" backend/src/api/ backend/src/services/` returns zero hits for city filtering.
4. No query result changes: a before/after comparison over the seed set returns identical sets.
5. Redundant single-field `city` indexes are gone; `db.hotels.getIndexes()` shows no duplication.
6. Page 500 of a paginated result returns in the same time as page 2.
7. The frontend sends `"Goa"`, not `"Goa, India"`. No server-side comma splitting remains.

---

# M10 — Worker Extraction & Queue Hardening

### Goal
Move the BullMQ worker out of the API process into its own deployable, configure the queue properly, and add the Socket.io Redis adapter.

### Why it matters
Per §9, two things break before anything else. First, `server.js:60` requires the worker into the API process, so a 20-second OpenAI call competes with HTTP handling on the same event loop and the two cannot scale independently. At 500 generations/hour against a single worker at concurrency 1, throughput caps around 180/hour and the backlog grows without bound.

Second — and this breaks at instance #2, not at scale — **Socket.io has no Redis adapter.** Behind a load balancer with two nodes, `io.to(room).emit()` reaches only sockets on the emitting process and most notifications silently vanish. Redis is already provisioned. This is a two-line fix that has never been made.

This is also the milestone that makes the §10 interview answer true.

### Features
- Separate `worker.js` entrypoint and container; remove `require('./workers/...')` from `server.js`
- Queue configuration that currently does not exist at all: `attempts: 3`, exponential `backoff`, `removeOnComplete: {age, count}`, `removeOnFail: {age}`, tuned `concurrency` (10–25; the work is I/O-bound)
- Idempotency via deterministic `jobId` so a double-click doesn't enqueue two paid OpenAI calls
- `@socket.io/redis-adapter`; force `transports: ['websocket']`; document sticky-session requirements
- Dead-letter handling and an admin view of failed jobs
- Queue depth and job duration metrics
- Dockerfiles for API, worker, and frontend; extend compose to the full stack with healthchecks
- Worker graceful shutdown draining in-flight jobs (extends M4)
- Decouple `ai.service` from owning a `Queue` instance — inject the client (§3.4 A5)

### Files that will change
- **Created:** `backend/src/worker.js`, `backend/src/config/queue.js`, `backend/Dockerfile`, `backend/Dockerfile.worker`, `frontend/Dockerfile`, `frontend/nginx.conf`
- `backend/src/server.js` — remove the worker require, add the socket Redis adapter
- `backend/src/workers/aiGenerator.worker.js` — standalone bootstrap, concurrency, shutdown
- `backend/src/services/ai.service.js` — injected queue client, job options, idempotency key
- `backend/src/services/queueListener.service.js` — shared queue config
- `backend/src/socket/index.js` — adapter wiring
- `backend/package.json` — `start:worker` script
- `docker-compose.yml` — api, worker, frontend services
- `frontend/src/api/client.js` — websocket-only transport

### Estimated complexity
**High** — 6–8 days. Mostly infrastructure; verifying multi-instance socket delivery needs a real two-node local setup.

### Dependencies
**M1** (the pipeline must work before it's split across processes), **M4** (correlation IDs must survive the process boundary).

### Acceptance criteria
1. API and worker run as separate processes. Killing the worker leaves the API fully responsive; jobs queue and drain when it returns.
2. **Two API instances behind a load balancer: a job completing on instance A reaches a client connected to instance B.** This is the Redis adapter test and it must be explicit.
3. A job failing transiently retries 3 times with growing delay, then dead-letters. Verified with an induced fault.
4. Completed jobs are evicted per policy; Redis memory is stable under sustained load.
5. Double-submitting the same generation request produces one job and one OpenAI call.
6. 20 concurrent generations complete without API p99 latency degrading more than 10% on unrelated endpoints. Measured before and after.
7. `docker compose up` starts the full stack; all healthchecks green.
8. Worker SIGTERM drains in-flight jobs before exit; no stalled jobs in Redis.

---

# M11 — Automated Testing & CI

### Goal
Build a real test suite over the now-stable contracts, and gate every merge on it.

### Why it matters
§10 is blunt: zero tests is an automatic downgrade at most companies and non-negotiable at senior level. Beyond the résumé argument, this is the milestone that makes M12 safe — AI grounding rewrites the worker end to end and should land on a tested base rather than a hopeful one.

Placed here rather than earlier because contracts have been in flux through M8. Testing a moving target means writing the tests twice; the M0 smoke harness has covered the interim.

### Features
- Unit tests: services, repositories, utilities, the AI integrator with a mocked OpenAI
- Integration tests: every route against `mongodb-memory-server`, real auth flows
- Queue integration tests with a real Redis (Testcontainers or a CI service container)
- Socket tests: handshake auth, room isolation, event delivery
- E2E with Playwright: register → login → search → generate → book
- Contract tests validating live responses against the OpenAPI spec
- Load testing with k6 — establish the baseline numbers §10 recommends publishing
- Coverage reporting with a floor (start at 60%, ratchet up)
- GitHub Actions: lint → typecheck → unit → integration → build → E2E on PR
- Frontend component tests with React Testing Library
- Test data factories

### Files that will change
- **Created:** `backend/tests/unit/**`, `backend/tests/integration/**`, `backend/tests/factories/**`, `backend/tests/helpers/**`
- **Created:** `frontend/src/**/*.test.jsx`, `frontend/vitest.config.js`
- **Created:** `e2e/**`, `playwright.config.js`
- **Created:** `.github/workflows/ci.yml`
- **Created:** `load/k6/*.js`
- `backend/package.json`, `frontend/package.json` — scripts, dev dependencies
- Minor refactors across `src/services/**` and `src/repositories/**` where singleton exports block injection (§3.4 A6)

### Estimated complexity
**High** — 10–12 days. The singleton-export refactor is the hidden cost: `new TripService()`, `new AIIntegrator()` etc. force module mocking, and some will need constructor injection to be testable.

### Dependencies
**M5**, **M7**, **M8** — contracts, auth, and data model must be stable.

### Acceptance criteria
1. `npm test` runs the full suite in under 5 minutes.
2. Coverage ≥ 60% overall, ≥ 80% on `services/` and `repositories/`.
3. Every route has at least one integration test covering success, validation failure, and authorization failure.
4. E2E covers the full journey against a real stack.
5. CI blocks merge on any failure.
6. The suite catches a deliberately introduced regression in the generation pipeline. **Verify this by actually introducing one.**
7. k6 baseline published in the README: p50/p95/p99 for search and generation, sustained throughput.
8. Zero flaky tests over 10 consecutive CI runs.

---

# M12 — AI Grounding & Structured Outputs

### Goal
Stop the model inventing hotels and start it selecting from real inventory, and replace the broken schema-in-prompt approach with OpenAI structured outputs.

### Why it matters
The biggest product and résumé win in the report, per §8.3 Tier 1. Today the model hallucinates `"Central Hotel Goa"` while the database holds real hotels with real prices and coordinates; the DB fetch happens *after* generation and is merely stapled alongside. Grounding converts Velora from "a chatbot that writes travel prose" into "a planner that reasons over real inventory" — every itinerary becomes bookable, priced, and mappable, and `MapView` finally has real data to plot.

There is also a silent bug to fix: `ai.integrator.js:37` sends `JSON.stringify(ItinerarySchema.shape)` as the schema. Zod's `.shape` holds internal class instances that serialize to near-empty objects — **the model is being shown nothing useful** and succeeds, when it succeeds, purely on the natural-language framing.

Note this **inverts the worker's current order**: fetch inventory *before* the model call, not after.

### Features
- Restructure the worker: fetch candidates → inject as a numbered catalogue → constrain output to reference real `_id`s → validate every referenced ID exists
- OpenAI structured outputs (`response_format: {type:'json_schema', strict: true}`) via `zod-to-json-schema`, replacing the stringified-shape prompt. Makes schema violations structurally impossible and **removes the need for the self-healing retry loop entirely.**
- Extend the schema with the fields the Mongoose model already has but Zod never populates: `end_time`, `coordinates`, plus `duration`, `estimated_cost`, `description`
- Trip-level `summary` and `total_estimated_cost`
- Feed `User.preferences` into the prompt — the field has existed since day one and has never been read
- Prompt versioning, externalised from string concatenation into versioned templates
- Token and cost logging per job; per-user cost attribution
- Semantic caching on embedded request parameters
- Model routing: `gpt-4o-mini` for simple trips, `gpt-4o` for complex multi-city
- Prompt-injection mitigation on the free-text `preferences` field
- Eval set of ~50 known-good requests with automated grading
- Fix the retry bug: `attempt < this.maxRetries` with `maxRetries = 2` yields exactly one retry
- Make the mock fallback loud instead of silently serving fake data as real

### Files that will change
- `backend/src/integrators/ai.integrator.js` — substantially rewritten
- `backend/src/workers/aiGenerator.worker.js` — inverted order, catalogue construction
- `backend/src/services/travelDataFetcher.service.js` — candidate selection for prompting
- `backend/src/services/ai.service.js` — model routing, cache lookup
- **Created:** `backend/src/prompts/itinerary/v1.js`, `src/services/aiCache.service.js`, `src/utils/tokenCounter.js`, `src/integrators/schemas/itinerary.schema.js`
- **Created:** `backend/evals/**`
- `backend/src/models/Itinerary.js` — richer activity fields
- `frontend/src/components/ItineraryDisplay.jsx` — render costs, durations, real links
- `frontend/src/components/MapView.jsx` — plot real itinerary coordinates

### Estimated complexity
**High** — 10–12 days. Prompt iteration is the unpredictable part; the eval set is what keeps it from being unbounded.

### Dependencies
**M8** (stable models), **M9** (candidate fetch must be fast — it's now on the critical path *before* the model call), **M10** (worker in its final home), **M11** (tests to refactor against).

### Acceptance criteria
1. Every activity in a generated itinerary references a real document by `_id`. Automated check: 100% resolve.
2. Zero hallucinated venue names over 20 consecutive generations across 10 cities. Manually verified.
3. Structured outputs enabled; the Zod retry loop is removed and no schema violation occurs over 50 generations.
4. `grep -n "JSON.stringify(ItinerarySchema.shape)" backend/` returns nothing.
5. Every activity carries coordinates; the map plots a complete itinerary.
6. Token count and USD cost logged per job and queryable per user.
7. Cache hit rate above 30% on a realistic request distribution.
8. `User.preferences` demonstrably changes output — same trip, different preferences, materially different itinerary.
9. Eval suite scores ≥ 80% on the graded rubric.
10. A prompt-injection attempt in `preferences` does not alter system behaviour.

---

# M13 — Frontend Architecture Refactor

### Goal
Break up the `MainPortal` god component, extract shared components, adopt a data-fetching library, and wire the frontend to the backend pagination that already exists.

### Why it matters
Per §3.4 A8, `MainPortal` holds nine `useState` hooks plus data fetching, business logic, and 150 lines of JSX. `ItineraryDisplay.jsx` is 487 lines, roughly 60% inline styling. There is no Context, no data-fetching library, and no custom hooks — defensible at one route, and M7 and M16 add several.

The pagination case is the clearest waste: the backend returns full pagination metadata on every inventory endpoint and the frontend ignores it, using client-side `slice()` over already-fetched data (`ItineraryDisplay.jsx:26`). We built the feature and never connected it.

### Features
- Extract custom hooks: `useServices`, `useItineraryGeneration`, `useSocket`, `useBooking`
- React Query (or SWR) for caching, deduplication, retries, stale-while-revalidate
- Extract the duplicated components identified in §3.1 D8–D10: `<FlightCard/>`, `<HotelCard/>`, `<RestaurantCard/>`, `<PlaceCard/>`, `<SkeletonCard/>`, `<ViewToggle/>`
- Split `ItineraryDisplay` into per-category child components
- Real routing: `/trips/:id`, `/search/:type`, `/bookings` — itineraries become shareable and bookmarkable
- Wire real backend pagination; remove client-side `slice()`
- Migrate inline styles to CSS modules or a styling library; eliminate the three-way styling split
- Route-level code splitting; dynamic import for Leaflet and Pannellum
- `PropTypes` (already a dependency, unused) or a TypeScript migration decision
- Trip dashboard listing the user's trips

### Files that will change
- `frontend/src/App.jsx` — reduced to routing and layout
- `frontend/src/components/ItineraryDisplay.jsx` — decomposed
- **Created:** `src/hooks/{useServices,useItineraryGeneration,useSocket,useBooking}.js`
- **Created:** `src/components/cards/{FlightCard,HotelCard,RestaurantCard,PlaceCard}.jsx`
- **Created:** `src/components/common/{SkeletonCard,ViewToggle,Pagination}.jsx`
- **Created:** `src/components/itinerary/{ScheduleView,FlightsView,HotelsView,RestaurantsView,PlacesView,CityGuideView}.jsx`
- **Created:** `src/pages/{Dashboard,TripDetail,Bookings}.jsx`
- **Created:** `src/context/AppContext.jsx`
- `src/components/{FlightBooking,HotelBooking,CabBooking}.jsx` — use shared cards
- `src/index.css` → CSS modules
- `vite.config.js` — code splitting, path aliases

### Estimated complexity
**High** — 8–10 days.

### Dependencies
**M5** (stable API client), **M7** (auth context and protected routes shape the routing).

### Acceptance criteria
1. `App.jsx` under 100 lines and holding no business logic.
2. No component exceeds 200 lines.
3. Flight and hotel cards are each defined once and used in both the list and itinerary views.
4. Pagination hits the backend; the network tab shows a request per page and no client-side `slice()` remains.
5. `/trips/:id` deep-links to a saved itinerary; refresh preserves state.
6. Initial bundle under 200 KB gzipped; Leaflet and Pannellum load on demand.
7. Tab switching serves cached data instantly and revalidates in the background — no full skeleton flash.
8. Every component has PropTypes or TypeScript types.

---

# M14 — Accessibility & Responsive Compliance

### Goal
Reach WCAG 2.1 AA and make the application genuinely usable on mobile.

### Why it matters
§5 identifies accessibility as the weakest dimension in the entire product: **zero ARIA attributes anywhere.** Icon-only buttons announce as "button". Tabs are plain `<button>`s with no `role="tablist"` or arrow-key navigation. Neither modal has `role="dialog"`, a focus trap, or an Escape handler — and `VRDestinationModal` covers the entire viewport, so a keyboard user who opens it is trapped with no way out. `.input-field` sets `outline: none` with no `:focus-visible` replacement, leaving keyboard users with no visible focus at all.

Responsive coverage is two breakpoints. The VR modal's info panel is `position:absolute` with `max-width:450px` over a `100vh` viewer — on a phone it covers the entire experience.

Placed after M13 because retrofitting ARIA onto components that are about to be decomposed means doing it twice.

### Features
- Full ARIA: `aria-label` on all icon-only controls, `role="tablist"`/`tab`/`tabpanel` with arrow-key navigation, `aria-live` on loading and error regions, `aria-expanded` on disclosures
- Accessible modals: `role="dialog"`, `aria-modal`, focus trap, focus restoration, **Escape to close** — including the VR modal
- Restore visible focus indicators; replace the blanket `outline: none`
- Fix colour contrast — `--text-muted: #64748b` on `--bg-primary: #090a10` is ~4.0:1, below the 4.5:1 AA threshold for body text
- `prefers-reduced-motion` guard on the infinite `pulse-glow` animation (a vestibular trigger) and all transitions
- Meaningful `alt` text; mark decorative emoji `aria-hidden` so screen readers stop reading 📍 and ⏰ aloud
- Full keyboard navigability with a logical tab order
- Mobile breakpoints for the header, VR modal, map view, and listing cards; remove the fixed inline `minWidth` values that overflow narrow screens
- Touch targets ≥ 44×44px
- Skip-to-content link
- Semantic landmarks

### Files that will change
- All files under `frontend/src/components/**` and `frontend/src/pages/**`
- `frontend/src/components/VRDestinationModal.jsx` — most affected; needs a mobile layout and a keyboard exit
- `frontend/src/components/MapView.jsx` — responsive height, keyboard-accessible markers
- `frontend/src/index.css` (or CSS modules) — focus states, contrast tokens, reduced motion, breakpoints
- `frontend/index.html` — landmarks, skip link
- **Created:** `frontend/src/hooks/{useFocusTrap,useEscapeKey}.js`
- **Created:** `e2e/accessibility.spec.js`

### Estimated complexity
**Medium** — 5–6 days.

### Dependencies
**M13** — components must be in final form.

### Acceptance criteria
1. axe-core reports zero violations on every route. Automated in CI.
2. The full journey — register → search → generate → book — is completable by keyboard alone.
3. The same journey is completable with a screen reader (test with NVDA or VoiceOver). Every control announces a meaningful name.
4. Both modals trap focus, close on Escape, and restore focus to the trigger.
5. All text meets 4.5:1 contrast; large text 3:1. Verified by tooling.
6. `prefers-reduced-motion: reduce` disables all non-essential animation.
7. Usable at 320px width with no horizontal scroll on any view.
8. Lighthouse accessibility ≥ 95 on every route.
9. The VR modal is usable and dismissible on a real phone.

---

# M15 — Caching & Performance

### Goal
Add the caching layer Redis is already provisioned for, and optimise the asset pipeline.

### Why it matters
Per §9 item 8, inventory data is near-static and re-queried from Mongo on every single request. Redis is in the stack and used solely as a queue broker. A cache-aside layer with a 5–15 minute TTL is plausibly a 90%+ reduction in database read load for a few days of work.

Hotel images are hotlinked from Unsplash at full resolution with no `srcset`, lazy loading, or CDN — the largest contributor to page weight.

### Features
- Redis cache-aside for inventory queries with a documented TTL and key scheme
- Cache invalidation on inventory writes
- HTTP caching: `Cache-Control`, `ETag`, conditional requests on inventory endpoints
- Image CDN with responsive variants; `srcset`, lazy loading, `width`/`height` to prevent layout shift
- Static asset CDN with long-lived cache headers
- Bundle analysis and tree-shaking pass
- Font loading optimisation — currently a render-blocking Google Fonts import at the top of `index.css`
- Prometheus metrics: request duration, cache hit rate, queue depth, DB query time
- OpenTelemetry tracing across API → queue → worker
- Grafana dashboards
- Re-run the k6 baseline from M11 and publish the delta

### Files that will change
- **Created:** `backend/src/services/cache.service.js`, `src/api/middlewares/httpCache.js`, `src/utils/metrics.js`, `src/utils/tracing.js`
- `backend/src/api/controllers/travel.controller.js` — cache-aside
- `backend/src/services/travelDataFetcher.service.js` — cache-aside
- `backend/src/server.js` — metrics endpoint, tracing init
- `frontend/src/components/cards/*.jsx` — responsive images
- `frontend/src/index.css` — font loading
- `frontend/vite.config.js` — chunking
- **Created:** `infra/grafana/**`

### Estimated complexity
**Medium** — 5–6 days.

### Dependencies
**M9** (optimise correct queries, not broken ones), **M10** (queue metrics need the worker split).

### Acceptance criteria
1. Cache hit rate above 80% on inventory endpoints under realistic traffic.
2. Cached responses served in under 10 ms p95.
3. An inventory write invalidates the relevant cache entries; no stale reads.
4. Repeat page loads serve images from CDN cache; total page weight reduced by ≥ 60%.
5. Lighthouse performance ≥ 90 on every route.
6. Cumulative Layout Shift under 0.1.
7. A trace for one generation shows every span from HTTP through worker to socket emit.
8. Grafana shows request rate, error rate, latency percentiles, cache hit rate, and queue depth.
9. k6 delta published: before/after throughput and latency.

---

# M16 — Feature Completion

### Goal
Build the features that were disabled in M2 or never existed, now that the foundation supports them properly.

### Why it matters
This is where the deferred work from M2 comes due, and where §4's "Missing" list gets addressed. The filter sidebar has been visibly disabled since M2 and needs to become real. Flights still have **no date field at all**, so the date every user carefully selects is silently ignored (§7.1) — the most surprising functional gap in the product.

Everything here was deliberately deferred until correctness was in place. Building real filters on unindexed regex queries, or date search on a schema with no dates, would have meant building them twice.

### Features
- **Real filter sidebar** — price range, rating, stops, category; server-side, indexed, URL-synced, with result counts
- **Date-aware flight search** — add the date dimension from §7.2 item 6, either `departureDate` on `Flight` or a `FlightRoute` + `FlightInstance` split. Convert `departureTime`/`arrivalTime` to real types and `duration` to `durationMinutes`.
- Geographic itinerary optimisation: migrate lat/lng to GeoJSON with `2dsphere` indexes, cluster each day's activities, compute realistic travel times. Per §8.3 Tier 3, use the LLM to choose *what* and a deterministic solver to choose *the order* — LLMs are poor at spatial optimisation and algorithms are excellent and far cheaper.
- Typeahead destination search over `Destination`, replacing the 40-city hardcoded `<select>`
- Trip management: edit, delete, duplicate, archive
- Saving and favouriting hotels, flights, and places
- Booking history with cancellation
- Budget tracking and cost roll-up per trip
- Email notifications for bookings
- Multi-city trips
- Sort controls on all listings

### Files that will change
- `backend/src/models/Flight.js` — date dimension, typed times (**breaking; needs migration**)
- `backend/src/models/{Hotel,Restaurant,TouristPlace}.js` — GeoJSON migration
- `backend/src/api/controllers/travel.controller.js` — filters, sorting, date-aware search
- **Created:** `backend/src/services/{itineraryOptimizer,notification,savedItems}.service.js`
- **Created:** `backend/src/models/SavedItem.js`
- **Created:** `backend/src/api/routes/{savedItems,search}.routes.js`
- **Created:** `backend/migrations/00X-flight-dates.js`, `00X-geojson.js`
- `frontend/src/App.jsx` — re-enable filters
- **Created:** `frontend/src/components/filters/**`, `src/components/DestinationSearch.jsx`, `src/pages/{TripEdit,SavedItems}.jsx`
- `frontend/src/components/SearchWidget.jsx` — typeahead
- `backend/seed/seed.js` — flight instances with dates, GeoJSON

### Estimated complexity
**High** — 12–15 days. The flight date migration is the largest single piece and reshapes seed data, queries, indexes, and UI together.

### Dependencies
**M12** (optimisation builds on grounded generation), **M13** (frontend architecture must support the new surfaces).

### Acceptance criteria
1. Every filter changes results server-side, is reflected in the URL, survives refresh, and shows accurate counts.
2. Flight search respects the selected date and returns only flights on that date.
3. `explain()` confirms date-aware flight queries use the compound index.
4. Generated itineraries are geographically sensible: same-day activities cluster, and travel time between consecutive stops is computed and displayed.
5. Destination typeahead returns results in under 100 ms and handles typos.
6. Users can edit, delete, and duplicate their own trips; ownership is enforced.
7. Booking history lists all bookings; cancellation updates status and sends an email.
8. Budget roll-up matches the sum of booked items.
9. Flight and GeoJSON migrations run forward and reverse without data loss.

---

# M17 — Advanced Product Capabilities

### Goal
Ship the differentiating features the schema has been designed for since the beginning but nothing has ever used.

### Why it matters
Two subsystems have been sitting half-built in the codebase from the start. `Itinerary` carries `versionName`, `isAIOriginal`, and `Trip` carries `originalAIVersion` / `currentVersion` — a complete versioning design with no version creation, diff, restore, or UI. And `socket/index.js:21–33` implements `join_trip` and `update_itinerary` handlers for collaborative editing that **the frontend has never emitted.**

Per §8.3 Tier 5, conversational refinement — "make day 2 more relaxed" — is exactly what those versioning fields exist for. This is where the original design finally gets realised.

**This milestone needs a design document before implementation.** Real-time collaborative editing with conflict resolution is a genuinely hard problem and should not be started from a roadmap bullet.

### Features
- Itinerary versioning: create, diff, restore, history UI
- Conversational refinement over generated itineraries with diff-based patching
- Real-time collaboration: invites, presence indicators, live cursors, CRDT or OT conflict resolution — activating the dormant socket handlers
- Drag-and-drop itinerary reordering (the `update_itinerary` handler already exists for it)
- Streaming AI generation over the socket so days appear as they're produced
- Payment integration (Stripe or Razorpay) with webhooks and refunds
- Function-calling AI assistant replacing the canned `setTimeout` responses in `FloatingAIAssistant`
- Trip sharing and public links
- Collaborative filtering recommendations
- PWA with offline itinerary access
- i18n and multi-currency
- Atlas Search for fuzzy, typo-tolerant destination search

### Files that will change
- **Created:** `backend/src/services/{version,collaboration,payment,recommendation}.service.js`
- **Created:** `backend/src/models/{Payment,Invitation,ItineraryVersion}.js`
- **Created:** `backend/src/api/routes/{payment,collaboration,version}.routes.js`
- `backend/src/socket/index.js` — substantially expanded; presence, CRDT sync
- `backend/src/integrators/ai.integrator.js` — streaming, tool calling
- **Created:** `frontend/src/components/collaboration/**`, `src/components/itinerary/VersionHistory.jsx`, `src/components/DragDropItinerary.jsx`, `src/pages/Checkout.jsx`
- `frontend/src/components/FloatingAIAssistant.jsx` — real backend
- **Created:** `docs/design/collaborative-editing.md` (**write this first**)

### Estimated complexity
**Very High** — 25–30 days, and this estimate is the least reliable in the document. Collaborative editing alone could consume all of it. Break into sub-milestones after the design doc exists.

### Dependencies
**M16**, plus a written and reviewed design document for the collaboration model.

### Acceptance criteria
1. Every itinerary edit creates a version; users can view a diff and restore any prior version.
2. "Make day 2 more relaxed" produces a modified itinerary as a new version with the original intact.
3. Two users editing one itinerary see each other's changes within 500 ms with no lost updates. **Verified under induced network partition**, not just on a good connection.
4. Drag-and-drop reordering persists and syncs to collaborators.
5. Streaming generation renders day 1 before the full response completes.
6. Payment flow completes end to end in sandbox, including webhook confirmation and refund.
7. The AI assistant answers inventory questions using real function calls against the database.
8. Offline: previously viewed itineraries remain accessible.
9. A design document for the collaboration model exists and has been reviewed before implementation begins.

---

## Cumulative effort

| Phase | Milestones | Effort | Outcome |
|---|---|---|---|
| **Correctness** | M0–M4 | ~13 d | Runs, tells the truth, pipeline works, is debuggable and secure |
| **Foundation** | M5–M9 | ~26 d | Unified contract, validated input, real auth, correct data model, usable indexes |
| **Scale & confidence** | M10–M11 | ~20 d | Independently scalable, horizontally viable, test-gated |
| **Product** | M12–M14 | ~28 d | Genuinely AI-powered, well-architected frontend, accessible |
| **Polish & growth** | M15–M17 | ~45 d | Fast, feature-complete, differentiated |

**M0–M11 is roughly 59 engineer-days.** That is the point at which every claim the project makes about itself becomes true, and the §10 interview answer becomes honest. If effort has to be capped somewhere, cap it there — that is the highest-value stopping point on this roadmap.

**M0–M2 is roughly 8 days** and resolves all three findings from the review's executive summary. If you only have two weeks, do that.

---

## Standing risks

| Risk | Milestone | Mitigation |
|---|---|---|
| M1 uncovers deeper breakage once jobs actually complete — this path has never demonstrably worked | M1 | Budget spare time; treat the estimate as optimistic |
| Auth refactor touches nearly every file and conflicts with parallel work | M7 | Freeze other backend work; land in one focused pass |
| Data model migrations lose or corrupt data | M8, M16 | Reverse migrations for every change; rehearse on a database copy first |
| AI prompt iteration is open-ended and can absorb unlimited time | M12 | The eval set is the exit criterion — stop at 80%, don't chase perfection |
| Collaborative editing is genuinely hard and the estimate is unreliable | M17 | Design doc and review gate before any code |
| Estimates assume no parallel feature work | All | Any concurrent feature development invalidates the sequence |

---

## Before we start

Four questions I need answered:

1. **Is there a demo, interview, or deadline that forces AI grounding (M12) earlier?** This changes the sequence materially and I'd rather plan for it than discover it. See sequencing note 4.
2. **TypeScript — migrate, or commit to JSDoc?** The decision belongs before M13, and making it late means redoing the frontend refactor.
3. **Where does this deploy?** Container platform vs. serverless changes M10's shape significantly.
4. **Is there production data anywhere?** If so, M8 and M16's migrations need a substantially more careful plan than described here.
