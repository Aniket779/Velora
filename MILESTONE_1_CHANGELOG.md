 # Milestone 1 — Restore the Async Generation Pipeline

**Status:** Complete
**Date:** 30 July 2026
**Scope:** Broken architecture only. No new features. M2 was not started.

---

## The correction that shaped this milestone

Before writing any code I checked the review's second headline claim — that BullMQ delivers
`returnvalue` as a raw string, so the queue listener's destructure silently yielded `undefined`.

**That claim was wrong for BullMQ 5.76.1**, the version pinned here. `QueueEvents` parses the
value before emitting (`queue-events.js:103`). I verified it by replaying the real library code
path — worker `JSON.stringify` → stream fields → `array2obj` → the parse switch:

```
CASE 1 typeof returnvalue : object
CASE 1 destructured       : { success: true, userId: 'user_123', hasItinerary: true }
CASE 1 VERDICT            : WOULD EMIT ✓
CASE 3 failed args        : {"event":"failed","jobId":"42","failedReason":"boom"}
CASE 3 userId present?    : false
```

So the **success** path was sound. What was actually broken:

- **CASE 3 is the real bug.** The `failed` event carries no user identity. There was no `userId`
  in scope to route to, which is precisely why the author left the emit commented out at
  `queueListener.service.js:43`. Any failed generation left the user on an infinite spinner.
- **The frontend bypass** — always the dominant issue, and unaffected by the correction.
- **No null guard** on the destructure. `JSON.parse(undefined)` throws `SyntaxError`, and an
  unhandled throw inside an async event handler can take the process down.
- **No job-ID correlation**, so a late result from an abandoned request would overwrite the view.

`ENGINEERING_REVIEW.md` has been amended with this correction rather than quietly edited.

---

## What changed and why

### 1. The frontend no longer generates itineraries

**`frontend/src/App.jsx`** — deleted `buildStructuredItinerary` (41 lines) and the five parallel
inventory fetches that fed it.

The old flow fired `POST /trips/generate` inside a `try/catch` that only `console.warn`ed, then
built the itinerary locally from a template loop. Because that path was synchronous with the
click, it always won the race. The backend result was never what the user saw.

`handleStartAIGeneration` now has **no code path that can produce an itinerary**. It posts,
reads the `jobId`, and waits. The only two writers of `generatedItinerary` are the socket handler
and the polling fallback, both of which carry backend payloads.

A failed POST now surfaces the real error with a retry button instead of being swallowed.

### 2. Failure notifications can now be routed

**`backend/src/services/queueListener.service.js`** — rewritten.

The listener now holds a `Queue` handle alongside `QueueEvents` so it can call `Job.fromId(jobId)`
and read `job.data.userId`. That is the only way to route a failure, since the event itself has no
identity. The same lookup doubles as the authoritative identity on the success path: job data is
what the caller *requested*, whereas the return value is what the worker *chose to send*. If they
disagree, the request wins (verified by test T8).

Also added: defensive `returnvalue` coercion that accepts object or string (removes the dependency
on library internals across versions), a fallback to the persisted `job.returnvalue`, a
`completed`-but-empty branch that notifies failure rather than going silent, try/catch around both
handlers so a throw cannot become an unhandled rejection, and a `stalled` listener.

Every dropped delivery is now logged with a reason. Previously they were silent.

### 3. Identity is threaded end to end

Previously `userId` was `'user_123'` hardcoded in `trip.controller.js:36` and *independently*
hardcoded in `App.jsx:162`. Two constants that happened to match is not routing — with two real
users, everyone lands in one socket room and receives everyone else's itineraries.

- **`frontend/src/utils/identity.js`** (new) — stable per-browser id in `localStorage`.
- **`backend/src/api/middlewares/identity.js`** (new) — reads `x-user-id` into `req.userId`.
- **`backend/src/constants/socketEvents.js`** (new) — `isValidUserId` charset guard, applied at
  both the HTTP edge and the socket handshake. Identity flows into room names, so an unvalidated
  value is interpolated into a room key.
- **`backend/src/socket/index.js`** — validates the handshake id instead of accepting it verbatim;
  joins the room *before* acknowledging, so there is no window where the client thinks it can
  receive events but has no room membership.

This is **not** authentication — the value is client-asserted and trivially spoofed. It exists so
routing correctness is real and testable now, and so M7 has exactly one place to change. Both new
files carry `TODO(M7)`.

### 4. Job-ID correlation, timeout, and a polling fallback

- **Correlation** — `activeJobIdRef` in `App.jsx`. Every inbound result is checked against it;
  anything else belongs to an abandoned request and is discarded. Without this, firing two
  generations means the slower one silently overwrites the newer.
- **Timeout** — 90 s, with a retry button. Previously a lost event meant an infinite spinner.
- **Polling fallback** — `GET /api/v1/trips/generate/:jobId`, polled every 5 s. If the socket
  never connects or the completion fires during a brief disconnect, the result is still delivered.
  The UI tells the user when it is in this degraded mode.
- **Ownership check** on that endpoint: a non-owner gets **404, not 403**, so the response does not
  confirm the job exists.

### 5. Removed a duplication class that could silently detach the pipeline

**`backend/src/config/redis.js`** (new). The Redis connection literal was duplicated in three
files and the queue name string `'ai-generation-queue'` sat beside each copy. A typo in any one
detaches a producer from its consumer — jobs enqueue onto a queue nobody listens to, with no error
anywhere. That is the same class of failure this milestone exists to eliminate, so it was fixed
here rather than deferred to M5. Now one definition, three importers.

### 6. Kept two features the deleted code was silently providing

Removing the client-side path would have regressed the **City Guide** tab and the **360° VR
viewer**, both of which read `travelData.destinationInfo` — fetched by the browser in the old flow
and never by the backend.

`travelDataFetcher.service.js` now fetches the `Destination` document as a fifth parallel query,
and `Itinerary.travelData.destinationInfo` was added to persist it. The worker emits one complete
payload; the browser renders exactly what it is given.

### 7. Crash bug in `ItineraryDisplay`

Two `useState` calls sat **after** `if (!itinerary) return null`, so the hook count changed between
renders — React throws *"Rendered more hooks than during the previous render."* It was masked
because the component only ever mounted with a populated itinerary. M1 makes
generate → clear → regenerate routine, turning a latent landmine into a reachable crash. All four
hooks moved above the early return.

Also: `activeCategory` defaulted to `'guide'`, but that tab only renders when `destinationInfo`
exists — so any city without a `Destination` document rendered a blank page. Now a derived default
that falls back to `'schedule'`.

### 8. Smaller fixes

| Change | Reason |
|---|---|
| Mock generator respects `days` | Returned 1 hardcoded day for any request. A 7-day trip rendered as 1 day, making the pipeline unverifiable without a paid API key. |
| Loud mock warning | A missing `OPENAI_API_KEY` silently served placeholder content as if real. |
| `.spin` CSS added | Referenced by `App.jsx`, defined nowhere. Cosmetic when the wait was fake; the wait is now genuinely ~20 s. |
| Graceful shutdown in `server.js` | `QueueEvents` holds a blocking `XREAD`; a worker killed mid-job leaves it stalled rather than releasing it for retry. |
| `frontend/src/config.js` | Two new endpoints would have added more hardcoded `localhost:5000` literals to the existing 12. Constant only — the full client is M5. |
| Deleted `AIGeneratorForm.jsx` | Dead fake-AI form, never imported. |
| Removed unused `mongoose` import from `server.js` | Dead. |

---

## Verification

79 checks across four harnesses, all passing.

| Harness | Checks | What it proves |
|---|---|---|
| Queue listener | 17 | Routing, both payload shapes, `Job.fromId` fallback, failure delivery, cross-user isolation, malformed identity rejection |
| Services | 25 | Input validation, identity in job data, ownership enforcement, terminal-state reporting, handshake charset guard |
| Worker | 20 | Mock day count, return-payload contract, complete travel payload incl. `destinationInfo`, error propagation |
| HTTP (real Express) | 17 | 202 + jobId, identity required, 4xx not 500, polling endpoint, 404 for non-owners, route ordering |

Plus: all 14 changed backend files pass `node --check`; all 15 frontend files parse under Babel
with JSX; automated hook-order audit clean; socket event names verified identical across the tier
boundary; every CSS class referenced by `App.jsx` confirmed defined.

**Acceptance criteria from the roadmap**

| # | Criterion | Result |
|---|---|---|
| 1 | Itinerary comes from the backend; killing the worker must not silently render a local one | ✅ No client-side generator exists. `grep buildStructuredItinerary` → 0 hits |
| 2 | Invalid API key → job fails → client sees a clear error | ✅ Harness T5 + W4 |
| 3 | Redis down → immediate explicit error at request time | ✅ Enqueue rejects; H2/H3 show 4xx surfacing |
| 4 | Two rapid generations → only the newest renders | ✅ `activeJobIdRef` guard; T1/T7 |
| 5 | >90 s → timeout state with working retry | ✅ Implemented, cleared on settle |
| 6 | Covers happy path, worker failure, malformed returnvalue, timeout | ✅ T1–T9, W4 |
| 7 | No `buildStructuredItinerary` in frontend | ✅ 0 hits |

### What I could not verify here, and why

The sandbox has **no Redis or MongoDB binary**, npm installs are blocked, `require('mongoose')`
stalls on load, and `node_modules` was installed on Windows so Vite's Linux native binding is
absent. I therefore could not run the true full stack.

I compensated by driving the **real application code** with stubbed infrastructure at the exact
seams that were unavailable, and by replaying BullMQ's actual serialization path rather than
trusting a code reading. That validates all the logic I changed. It does **not** substitute for
one run against live Redis and Mongo.

**Please run this once on your machine before treating M1 as closed:**

```bash
docker compose up -d
cd backend && npm run dev        # worker starts in-process (M10 splits it out)
cd frontend && npm run dev
```

Then: generate an itinerary; stop the worker mid-generation and confirm you get an error rather
than a silent local itinerary; set a bad `OPENAI_API_KEY` and confirm the failure message reaches
the browser; open two browsers and confirm each receives only its own result.

Note there is **no seed data yet** (M0), so inventory arrays will be empty until you populate
Mongo. The schedule still generates — the inventory tabs will just be empty.

---

## Deliberately not done

| Item | Milestone |
|---|---|
| Real authentication; delete both identity shims | M7 |
| Trip created before enqueue so the Itinerary links back (`isValidObjectId` is still always false for `temp_trip_*`) | M8 |
| Worker extracted to its own process; `attempts`/`backoff`/`removeOnComplete`; Socket.io Redis adapter | M10 |
| Fake filter checkboxes; fabricated booking success in `BookingModal`; error boundary; shared `viewMode` bug | M2 |
| Grounding the AI in real inventory; structured outputs; the `JSON.stringify(schema.shape)` bug | M12 |
| Permanent test suite (these harnesses live in `/tmp`) | M11 |

The `attempts` omission is intentional: without queue-level retry a transient failure surfaces as
an honest error rather than a silent hang. That is correct M1 behaviour. M10 adds the retry.
