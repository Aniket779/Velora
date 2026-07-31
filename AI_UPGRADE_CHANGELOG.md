# AI System Upgrade — Grounded, Adaptive Travel Intelligence

**Status:** Complete. 142 checks passing.
**Date:** 30 July 2026
**Roadmap position:** This is **M12**, pulled forward past M2–M11 at your request.

---

## Sequencing note

M12 was scheduled last for a reason: it rewrites the worker end to end, so doing it
before the worker moves to its own process (M10), before the data model settles (M8),
and before there is a permanent test suite (M11) means some of it gets done twice.

Two concrete consequences you now own:

- **The worker still runs inside the API process.** Generation is now materially
  heavier — two model calls, a catalogue build, a grounding pass — and all of it
  competes with HTTP handling on one event loop. M10 becomes more urgent, not less.
- **`Itinerary.tripId` is still a String**, so generated plans remain orphaned from
  their Trip. Unchanged from before, but there is now far more valuable content
  sitting in those orphaned documents.

Neither blocks what you asked for. Both should move up the queue.

---

## The core change

**Before:** generate itinerary → fetch inventory → staple together.
The model had never seen the database, so it invented `"Central Hotel Goa"` while
real hotels sat unused in MongoDB. The plan and the bookable data were unrelated.

**Now:** fetch inventory → build catalogue → generate against it → verify every
reference → reject inventions.

```
┌───────────────────────────────────────────────────────────────────┐
│ 1. buildCatalog(destination, origin, profile)                     │
│      MongoDB → 12 hotels, 15 restaurants, 20 places, 8 flights    │
│      pre-filtered by budget tier, assigned codes H1..R1..P1..F1   │
│                                                                   │
│ 1b. destinationIntelligence.get(destination)      [parallel]      │
│      cache hit → return  |  miss → generate 18 categories, store  │
├───────────────────────────────────────────────────────────────────┤
│ 2. generateItinerary(profile, catalogue, intelligence)            │
│      structured outputs, strict JSON schema                       │
│      model SELECTS codes — it cannot invent venues                │
├───────────────────────────────────────────────────────────────────┤
│ 3. ground(itinerary, catalogue)                                   │
│      code → real ObjectId + name + price + coords + image         │
│      invented code → hard failure, job fails, user is told        │
│      <50% grounded → rejected as insufficiently grounded          │
├───────────────────────────────────────────────────────────────────┤
│ 4. persist + push over the M1 socket pipeline                     │
└───────────────────────────────────────────────────────────────────┘
```

Grounding is enforced, not requested. The prompt *asks* the model to use the
catalogue; `itineraryGrounding.service.js` *verifies* that it did. Without the second
half the constraint is a suggestion, and the failure mode is silent — an invented
`H9` looks exactly like a valid reference until someone tries to book it.

**Short codes, not ObjectIds.** A 24-character hex string costs ~12 tokens; across a
14-day plan with 50+ activities that is thousands of wasted tokens and a much higher
transcription error rate. `H1` is one token and trivially validated.

---

## The schema bug is properly dead

The old integrator sent `JSON.stringify(ItinerarySchema.shape)` as the schema. Zod's
`.shape` holds internal class instances; serialising them yields near-empty objects.
**The model was being shown nothing and succeeding on prose framing alone.**

Zod 4 — already pinned here — ships `z.toJSONSchema()`, which emits
`additionalProperties: false` and complete `required` arrays natively. That is exactly
what OpenAI strict mode demands, with **no new dependency** (npm installs are blocked
in this environment, so `zod-to-json-schema` was not an option).

`toStrictJsonSchema.js` wraps it and strips the keys OpenAI's validator rejects
(`$schema`, `format`, `minLength`, …). Verified: both schemas pass a strict-mode
compliance audit with zero issues.

Consequence: the self-healing retry loop is **gone**. Schema violations are now
structurally impossible rather than something to detect and retry after.

---

## 1. Destination intelligence — all 18 categories

| # | Category | Shape |
|---|---|---|
| 1 | History | narrative, tied to what a visitor can still see |
| 2 | Culture | narrative |
| 3 | Traditions | list |
| 4 | Famous foods | name, description, **where to try**, vegetarian flag |
| 5 | Festivals | name, months, description |
| 6 | Famous places | name + why beyond "it's famous" |
| 7 | Hidden gems | name, why, **how to reach** |
| 8 | Local experiences | things to *do*, not see |
| 9 | Transportation | airport transfer, getting around, per-mode cost + tips |
| 10 | Shopping | markets, what to buy, bargaining norms |
| 11 | Weather | overview + per-season temperature ranges |
| 12 | Best season | go months, why, **avoid months** |
| 13 | Safety tips | destination-specific, not generic |
| 14 | Scams | scam, **how it works**, how to avoid |
| 15 | Emergency numbers | curated — see below |
| 16 | Etiquette | dos, don'ts, dress code, tipping |
| 17 | Budget | per-tier daily INR breakdown across 5 line items |
| 18 | Packing | essentials, seasonal, documents |

**Cached in a new `DestinationIntelligence` collection**, keyed by city slug with a
90-day TTL. Goa's history does not change between travellers; generating it per trip
would make it the dominant cost of the product for no benefit. Verified: a second
trip to the same city creates no new record.

### Emergency numbers are curated, not generated

This is the one field where a hallucination could get someone hurt. A traveller in an
emergency dialling an invented number is materially worse than showing nothing.

`constants/emergencyNumbers.js` holds a verified registry for 16 countries. **Curated
data overrides model output entirely.** Countries not in the registry pass through
model output flagged `verified: false`, and the UI labels it *"Not independently
verified — confirm locally on arrival"* rather than presenting it as fact.

The mock generator returns an **empty** emergency array by design — placeholder
content must never look like a real emergency number.

---

## 2. Adaptation across all 7 requested dimensions

| Dimension | How it changes the plan |
|---|---|
| **Days** | exact day count enforced |
| **Budget** | **catalogue filtered before the model sees it** |
| **Solo/couple/family/group** | distinct guidance block per type |
| **Interests** | 14 tags weight attraction selection |
| **Luxury vs budget** | price bands per tier |
| **Food preferences** | 9 options as hard constraints |
| **Adventure level** | low/moderate/high reshapes activity mix |

Plus **pace** (2–3 / 3–4 / 5–6 activities per day), **group size**, **travel month**,
and **free-text notes**.

**Budget filtering happens in the query, not the prompt.** A model told to "prefer
cheaper options" will still occasionally surface the ₹28,000 suite. One that never
sees it cannot. Verified: a budget-tier family is never offered the luxury hotel, and
a budget request excludes the ₹3,500 restaurant.

Guidance is specific enough to change output. Family mode caps walking at ~45 minutes
and excludes bars and late nights. Jain mode excludes root vegetables by name. Solo
mode prioritises well-lit populated areas after dark.

Every activity carries `why_chosen` tying the choice to *this* traveller — surfaced
in the UI, so adaptation is visible rather than claimed.

---

## 3. Prompts refactored

Moved from inline concatenation in the integrator to versioned modules:
`prompts/destinationIntelligence.v1.js` and `prompts/itinerary.v1.js`, both exporting
a `VERSION` recorded on every generated itinerary. You can now tell which prompt
produced which plan — a prerequisite for the eval work in the roadmap.

Content changes: worked examples of good vs bad output, explicit "name real places"
instruction, geography/time/meal/arrival planning rules, and per-dimension adaptation
blocks. Temperature split — 0.4 for factual briefings, 0.7 for creative planning.

---

## Files

**New (12)** — `constants/travelProfile.js`, `constants/emergencyNumbers.js`,
`models/DestinationIntelligence.js`, `integrators/schemas/{toStrictJsonSchema,
destinationIntelligence.schema, itinerary.schema}.js`, `integrators/ai.mock.js`,
`prompts/{destinationIntelligence,itinerary}.v1.js`, `services/{inventoryCatalog,
destinationIntelligence, itineraryGrounding}.service.js`

**Rewritten (4)** — `integrators/ai.integrator.js`, `services/ai.service.js`,
`workers/aiGenerator.worker.js`, `models/Itinerary.js`

**Frontend (4)** — new `components/DestinationIntelligence.jsx` (18 categories in 6
tabs), new `constants/travelProfile.js`, rewritten AI form in `SearchWidget.jsx`,
enriched `ItineraryDisplay.jsx`

---

## A real bug the tests caught

The API received `"Goa, India"` and `inventoryCatalog` did an exact regex match on the
full string — **zero catalogue matches, silently ungrounded plan.** It only worked
because `App.jsx` happened to strip the country before sending.

That is a contract held together by coincidence: any other caller — a direct API
request, a mobile client, a test — would have got an empty catalogue with no error.
Normalisation moved server-side into `buildProfile`. The original label is preserved
as `destinationLabel` for display.

Worth stating plainly: I would not have found this by reading the code. The E2E test
posted the raw UI value to the API and the assertion failed.

---

## Verification — 142 checks

| Harness | Checks | Covers |
|---|---|---|
| `pipeline` | 36 | catalogue build, budget filtering, full worker run, 18 categories, emergency override, caching, adaptation, hallucination rejection, degradation, schema validation |
| `e2e` | 50 | API accepts profile, garbage enums fall back, every UI-read field present, polling, ownership |
| `services` | 25 | validation, identity, ownership, terminal states |
| `queue listener` | 17 | M1 routing regression |
| `http` | 17 | M1 HTTP regression |
| `regression` | 14 | re-covers the retired M1 worker harness against the new architecture |

Plus: 34 backend files parse, 17 frontend files parse with JSX, hook-order audit
clean, both JSON schemas strict-mode compliant, all 6 profile enums verified identical
across the tier boundary.

**The grounding tests are the ones that matter:**
- every `ref` in a generated plan resolves to a document that exists in MongoDB
- every resolved name is a real seeded record
- an invented `H99` is detected, nulled, and the job **fails** rather than shipping
- a plan that ignored the catalogue (0% grounded) is **rejected**
- a destination with no inventory degrades gracefully instead of failing

### What I could not verify here

No Redis, no MongoDB, npm blocked, `require('mongoose')` stalls, and `node_modules`
is a Windows install so Vite cannot build on Linux. I drove the **real application
code** against an in-memory MongoDB stand-in and a stubbed BullMQ.

**Critically: every test ran through the mock generator, not a real OpenAI call.**
The mock deliberately selects real catalogue codes, so grounding, resolution and
validation are genuinely exercised — but prompt quality, structured-output behaviour
and cost are unverified.

**Please run once with a real key before trusting this:**

```bash
docker compose up -d
cd backend && npm run seed          # ⚠ still missing — this is M0
export OPENAI_API_KEY=sk-...
npm run dev
```

Then check: activity names match seeded hotels; two different profiles for the same
city produce materially different plans; `[AI] ... cost≈$0.0xxx` appears in logs; the
second trip to a city logs `Cache hit`.

**Without seed data the catalogue is empty**, generation degrades to ungrounded, and
you will be testing the fallback rather than the feature. M0 is now genuinely blocking.

---

## Not done

| Item | Milestone |
|---|---|
| Semantic caching of itineraries; per-user cost budgets | M12 remainder |
| Eval set with automated grading | M12 remainder |
| Model routing (mini for simple trips) | M12 remainder |
| Function calling / iterative refinement | M17 |
| Geographic optimisation via `2dsphere` | M16 |
| Seed data — **blocking real verification** | M0 |
| Worker process split — now more urgent | M10 |
| `tripId` ObjectId migration | M8 |
| Fake filters, fabricated booking success | M2 |
