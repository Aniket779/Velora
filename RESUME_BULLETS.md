# Velora — Resume Bullet Points

Pick the version that fits your space. Every claim here is defensible — you can back all of it up from the code.

---

## Standard version (use this one)

**Velora — AI Travel Planner** · *React, Node.js, Express, MongoDB, Redis, BullMQ, Socket.io, OpenAI*

- Built an AI itinerary generator using **RAG** — retrieved candidate hotels, restaurants and attractions from MongoDB, injected them into the prompt, and **validated every AI response against real database records**, rejecting outputs containing hallucinated venues
- Architected an **asynchronous job pipeline** with BullMQ and Redis so 30-second AI calls run in the background; API returns `202` with a job ID and results are pushed over **Socket.io**, with a polling fallback and 90-second timeout
- Implemented **OpenAI structured outputs** with Zod-derived JSON Schema, making malformed responses structurally impossible; added exponential-backoff retries and per-request token/cost logging
- Personalised itineraries across **7 dimensions** (budget, group type, interests, adventure level, dietary needs, pace, duration), applying budget filtering at the **database query layer** so out-of-range options never reach the model

---

## Short version (2 bullets)

**Velora — AI Travel Planner** · *React, Node.js, MongoDB, Redis, BullMQ, Socket.io, OpenAI*

- Built a **RAG-based** travel planner that grounds AI output in MongoDB records and rejects responses referencing non-existent venues; personalises across 7 traveller dimensions
- Designed an **async job pipeline** (BullMQ/Redis) with **WebSocket** delivery for 30-second AI generations, including structured outputs, retry logic and cost tracking

---

## One-liner (for a projects list)

- **Velora** — AI travel planner using RAG over MongoDB with hallucination detection, async BullMQ job processing and real-time Socket.io delivery *(React, Node, MongoDB, Redis, OpenAI)*

---

## Longer version (if you have space, or for a portfolio site)

**Velora — AI-Powered Travel Planner**
*React 19, Node.js, Express, MongoDB, Redis, BullMQ, Socket.io, OpenAI GPT-4o, Zod*

- Engineered a **retrieval-augmented generation (RAG)** pipeline that queries MongoDB for real travel inventory, injects a labelled catalogue into the prompt, and constrains the model to select from it — eliminating hallucinated venues that plague single-call LLM integrations
- Built a **verification layer** that resolves every AI-returned reference back to its source document and fails generation when references are invented or when fewer than 50% of activities are grounded in real data
- Implemented **asynchronous processing** with BullMQ on Redis: the API responds in milliseconds with a job ID while a worker handles generation, delivering results via **Socket.io** to per-user rooms with an HTTP polling fallback
- Applied **OpenAI structured outputs** using JSON Schema derived from Zod, with 3-attempt exponential backoff on rate limits and timeouts, plus token and cost telemetry per request
- Designed a **cache-aside layer** for AI-generated destination research (18 knowledge categories), cutting repeat generation cost to zero with a 90-day TTL in MongoDB
- Modelled **9 MongoDB collections** with compound indexes tuned to query patterns (`city + rating`, `from + to + price`)

---

## Word choices that matter

**Use these — they're what recruiters and ATS search for:**

| Say this | Not this |
|---|---|
| RAG / Retrieval Augmented Generation | "used AI" |
| Grounded AI output in database records | "connected to MongoDB" |
| Hallucination detection and rejection | "checked the output" |
| Asynchronous job processing | "background tasks" |
| Structured outputs / schema-constrained generation | "made sure JSON was valid" |
| WebSocket push with polling fallback | "real-time updates" |
| Cache-aside pattern | "saved results" |

**RAG is the single highest-value term here.** It's what people are hiring for right now, and you genuinely implemented it — retrieval, augmentation, generation, all three.

---

## Things NOT to claim

Don't write these. You'll get caught:

- ❌ "Scaled to X users" — you haven't
- ❌ "Reduced latency by X%" — you have no before/after benchmark
- ❌ "Implemented authentication" — not built yet
- ❌ "Full test coverage" — no committed test suite
- ❌ "Production deployment" — unless you actually deploy it

**If you want a metric you can defend,** deploy it and measure real generation time, then write *"~30s average generation time, handled asynchronously"*. A measured number beats an invented percentage.

---

## Making it stronger before you apply

Ranked by impact per hour of effort:

1. **Deploy it** (Render/Railway backend, Vercel frontend). A live link doubles the credibility of everything above.
2. **Add screenshots to the README.** Most people never clone the repo — the README *is* your project to them.
3. **Record a 60-second demo video.** Link it at the top of the README.
4. **Write 3–4 tests.** Then you can honestly say "tested" instead of explaining why you didn't.
5. **Clean the git history.** `git log --oneline` should read like sensible work, not `fix`, `fix2`, `final`.
