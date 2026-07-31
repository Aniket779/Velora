# Velora — Interview Prep

Questions you'll actually get, with answers in your own voice. Read the answers, then say them your own way — don't memorise word for word, it sounds rehearsed.

---

## The opener (you'll get this every time)

### Q1. "Tell me about this project."

> "Velora is an AI travel planner. You give it a destination, how many days, your budget and who you're travelling with, and it generates a day-by-day plan.
>
> The part I'd point at is that the AI is grounded in my own MongoDB data. Most AI projects just forward a prompt to OpenAI and get back invented places. Mine queries the database first, puts the real hotels and restaurants into the prompt, and then verifies the AI actually used them.
>
> It's React on the frontend, Node and Express on the backend, MongoDB for data, and BullMQ on Redis for background jobs because generation takes about 30 seconds."

**Why this works:** it names the differentiator in the first 20 seconds instead of listing technologies.

---

### Q2. "Walk me through what happens when a user clicks Generate."

Trace it out loud, don't rush:

> "The browser POSTs to `/api/v1/trips/generate` with the traveller profile.
>
> The controller validates it and calls `ai.service`, which adds a job to the BullMQ queue and immediately returns a job ID. The API responds 202 Accepted — it does not wait.
>
> The worker picks up the job and does four things. One, it queries MongoDB for hotels, restaurants, attractions and flights in that city, filtered to the budget tier, and in parallel fetches the cached city briefing. Two, it builds a text catalogue where each item gets a code like H1 or R2, puts that in the prompt, and calls OpenAI. Three, it takes every code the AI returned and looks it up — if the AI invented a code, the job fails. Four, it saves the itinerary.
>
> When the job completes, BullMQ fires an event. My queue listener catches it, finds which user owns that job, and emits over Socket.io to that user's room. The browser is listening and renders it.
>
> If the WebSocket is down, the browser polls a job-status endpoint every five seconds as a fallback, and times out after 90 seconds with a retry button."

---

## The AI questions (this is where you win or lose)

### Q3. "How do you stop the AI hallucinating?" ⭐ most important

> "Two layers.
>
> First, prevention. I don't ask the AI to think of hotels — I give it a list. I query MongoDB, take the top 12 hotels and 15 restaurants for that city, label them H1 through H12, R1 through R15, and put that list in the prompt. The instruction is: pick from this list and reference by code. Selecting from a list is a much easier task than recalling facts, so it's far more reliable.
>
> Second, verification. The prompt *asks* it to behave — it doesn't guarantee it. So after generation I walk every activity, take its code, and look it up in the catalogue. If the AI returned H99 and my catalogue only went to H12, that's a hallucination. I reject the whole plan and fail the job so the user gets an honest error and it can retry.
>
> I also have a threshold — if fewer than half the activities reference real data, I reject it, because that means the AI mostly ignored my catalogue."

**Follow-up: "Why not just tell it not to hallucinate?"**
> "Because that's a request, not a constraint. Models comply most of the time, and the failure is silent — an invented hotel looks completely real until a user tries to book it. I'd rather fail loudly than show fake data."

### Q4. "Why short codes like H1 instead of MongoDB IDs?"

> "Two reasons. Cost — a MongoDB ObjectId is 24 hex characters, roughly 12 tokens. Across a 14-day plan with 50 activities that's hundreds of wasted tokens on every single request. H1 is one token.
>
> And reliability — models mistype long random hex strings. Short codes are easy to produce correctly and easy for me to validate with a regex."

### Q5. "How do you make sure the AI returns valid JSON?"

> "I use OpenAI's structured outputs. I define the shape in Zod, convert it to JSON Schema, and send that with the request. The model is constrained while it's generating, so malformed JSON is structurally impossible rather than something I catch afterwards.
>
> I still run Zod validation on the response as a second check before anything touches the database — structured outputs guarantee shape, not that my schema and my code agree."

**Follow-up: "What did you do before that?"**
> "Originally I had a retry loop — validate with Zod, and if it failed, send the error back to the model and ask it to fix it. It worked, but structured outputs made it unnecessary. Honestly the earlier version also had a bug: I was serialising the Zod schema with `JSON.stringify`, which produces an empty object. The model was being shown nothing and succeeding on the plain-English instructions alone."

> ⚠️ **Only mention that bug if they ask about your process.** It's a great answer to "tell me about a bug you found" but don't volunteer it unprompted.

### Q6. "How does the itinerary adapt to different users?"

> "Seven inputs: days, budget, traveller type, interests, adventure level, food preferences and pace.
>
> The important one is budget, because I handle it in the database query rather than the prompt. Picking budget tier adds a price ceiling to the MongoDB query, so expensive hotels are never in the AI's list at all. If you just tell a model 'prefer cheaper options' it'll still occasionally suggest the expensive one. If it never sees it, it can't.
>
> The ceiling is relative to the destination, not a fixed number. I originally hardcoded budget as under ₹3,500 a night, which works in India and is meaningless in Dubai — nothing there is that cheap, so the filter matched nothing and fell through to unfiltered results. Now it's a multiplier of the destination's own price tier, so 'budget' means the cheaper end of whatever that city actually costs.
>
> The others go into the prompt as explicit rules. Family mode caps walking at 45 minutes and excludes bars and late nights. Jain mode excludes root vegetables by name. Each activity also comes back with a `why_chosen` field tying the choice to that specific traveller, which I show in the UI."

### Q7. "What does it cost to run?"

> "Roughly 2 to 5 cents per itinerary on GPT-4o. I log token counts and estimated cost on every call.
>
> The bigger saving is caching. The 18-category city briefing — history, food, festivals, scams, budgets — is the expensive call, but Goa's history doesn't change between users. So I generate it once, store it in MongoDB, and reuse it for 90 days. Only the itinerary itself is generated per request."

---

## The system design questions

### Q8. "Why a job queue? Why not just call OpenAI in the request?"

> "Generation takes 20 to 40 seconds. Three problems with doing it in the request.
>
> Browsers and load balancers time out around 30 to 60 seconds, so it's fragile. The connection is held open the whole time. And if the server restarts mid-request, the work is lost with no way to recover.
>
> With a queue the API responds in milliseconds with a job ID. The work survives a restart because it's in Redis. And I can scale workers independently of the API."

**Follow-up: "Why BullMQ specifically?"**
> "It's Redis-backed, which I already had, and it gives retries, job state and events out of the box. The alternative would be a simple database-polling queue, but that's more work and less reliable."

### Q9. "How does the frontend know when the job is finished?"

> "Socket.io. On connect, each user joins a room named `user_<their id>`. When a job completes, BullMQ fires an event, my listener figures out which user owns that job, and emits to just that room.
>
> There's a detail worth mentioning: the BullMQ `failed` event doesn't include the user ID — only the job ID and the reason. So for failures I look the job up by ID and read the user ID off the job data. Without that, failed generations could never be reported and users would wait on a spinner forever.
>
> And I don't rely on the socket alone. The browser also polls a status endpoint every five seconds and times out at 90 seconds."

### Q10. "What breaks if you get 1 million users?"

Pick two or three, don't recite a list:

> "First thing: my worker currently runs inside the API process. A 30-second AI call competes with HTTP handling on the same event loop, so response times for everything else degrade. The fix is running the worker as a separate container that scales on queue depth.
>
> Second: Socket.io has no Redis adapter, so with two servers behind a load balancer a push only reaches clients connected to the emitting instance. That's a small fix but it breaks silently, which makes it worse.
>
> Third: my city lookups use case-insensitive regex, and a regex with the `i` flag can't use a MongoDB index — so those queries do full collection scans despite the indexes existing. The fix is storing a normalised lowercase `citySlug` and doing exact matches."

**This answer is gold** — it shows you understand your own system's limits, which is rarer than building it.

### Q11. "Walk me through your authentication." ⭐ asked constantly

> "Email and password, bcrypt at cost 12, JWT for the session.
>
> The part I'd point at is that the whole app reads one value — `req.userId`. That was true before auth existed, when identity was just a header. So adding real auth changed how that value gets *populated* and touched almost nothing else. About 18 places read it and none of them needed editing.
>
> There are two ways to become a `req.userId`. A verified JWT gives you your account's ObjectId. Or, if you're browsing as a guest, a `guest_` header gives you an anonymous id — because I wanted people to be able to generate an itinerary before signing up."

**Then they will ask the follow-up. Have it ready:**

### Q11b. "But the guest header is client-supplied. Can't I just send someone else's user id?"

> "No, and that's the one design decision I'd defend hardest. Guest ids are namespaced — the backend only accepts a header identity matching `^guest_[A-Za-z0-9]{8,56}$`. An account id is a 24-character hex ObjectId, so it can never match that pattern. Real user ids can only ever come out of a signature I verified.
>
> So a forged header can only impersonate another guest, and guest data is anonymous by definition. The two id spaces are disjoint on purpose."

### Q11c. "What about the WebSocket?"

> "Same check, and it has to be. Finished itineraries are emitted to a `user_<id>` room, so whoever controls the id controls whose results they receive. If the HTTP layer were locked down but the handshake still took the id on trust, an attacker would just sit in your room and collect your itineraries as they generated.
>
> The handshake verifies the token and takes the id from the `sub` claim. Never from the handshake payload."

### Q11d. "How do you store passwords?"

> "bcrypt at cost 12, hashed in a Mongoose `pre('validate')` hook so no route or seed script can write a plaintext password — there's no code path around it.
>
> One detail I got wrong first: I put it in `pre('save')`, and every registration failed with 'passwordHash is required'. Mongoose runs validation *before* save hooks, so the required check fired before the hook that sets the field. Moving it to `pre('validate')` fixed it.
>
> The hash is also `select: false`, so it never comes back from a query unless something explicitly asks for it. Login is the only place in the codebase that does."

### Q11e. "Anything you did for security beyond the basics?"

> "Three things.
>
> Login returns the same error for an unknown email and a wrong password, so the form can't be used to check which emails have accounts. And it still runs a bcrypt comparison when the email doesn't exist — otherwise that request returns in 1ms versus 250ms for a real account, and the timing leaks exactly what the identical message was hiding.
>
> That dummy hash is generated at startup rather than hardcoded. bcrypt returns false instantly on a malformed hash, so a hand-typed constant with one wrong character would look right, pass review, and silently disable the whole defence.
>
> And login is rate limited — 10 attempts per IP per 15 minutes. Partly against brute force, partly because bcrypt is deliberately expensive, so parallel guesses are also a DoS vector against my own CPU."

### Q12. "Why MongoDB and not SQL?"

> "The generated itinerary is a deeply nested document — days containing activities containing resolved references. In SQL that's three or four joins on every read. In MongoDB it's one document.
>
> That said, the travel inventory itself is quite relational, and if I were adding bookings and payments I'd want transactions. For a real product I'd probably consider Postgres with JSONB."

**Don't oversell MongoDB.** Acknowledging the trade-off scores better than defending the choice.

---

## The code-quality questions

### Q12b. "Tell me about a performance problem you found." ⭐ strong answer

> "My city lookups used a case-insensitive regex — `/^Goa$/i` — against an indexed
> field. That looks fine, but MongoDB can't use an index for a regex with the `i`
> flag, so every search did a full collection scan. The indexes existed and cost me
> on every write, but were never used on a read.
>
> With three hotels you'd never notice. I'm now at 12,000 documents, so I added a
> `citySlug` field — a normalised lowercase key set automatically before save — and
> query it with an exact match instead. Same results, index seek instead of a scan.
>
> The seed script ends by running `explain()` on a real query and printing whether
> the plan is IXSCAN or COLLSCAN, so if someone reintroduces a regex lookup the seed
> output tells them immediately."

**Follow-up: "Any other data bugs?"**
> "Yes, and it only appeared when I expanded internationally. My budget filter used
> absolute rupee caps — budget meant under ₹3,500 a night. That's sensible in India
> and meaningless in Dubai, where nothing is that cheap. The filter matched zero
> hotels, silently fell back to unfiltered results, and showed budget travellers
> ₹37,000 suites. I changed the bands to multipliers of the destination's own price
> tier, so 'budget' means the cheaper end of whatever that city actually costs."

### Q13. "Walk me through your folder structure."

> "Backend is layered. Routes map URLs to controllers. Controllers only handle HTTP — request in, response out, no logic. Services hold the business logic. Models are the Mongoose schemas. There's a repository for database queries on trips.
>
> The AI code is isolated in its own folder — one file that calls OpenAI, one with the prompts, one with the schemas, one with mock data. If I switched to Claude, only `ai/openai.js` would change."

### Q14. "What would you refactor?"

> "A few things.
>
> I have two API surfaces that return the same hotel data in different shapes — `/api/hotels` and `/api/v1/services/hotels`. That's history, and it forced defensive code in the frontend where I check `hotel.hotelName || hotel.name`. I'd unify them.
>
> The repository pattern is only applied to trips, not the inventory models, which is inconsistent. Either commit to it everywhere or drop it.
>
> And my main React component holds too much state — nine `useState` hooks plus data fetching. I'd pull it into custom hooks."

### Q15. "How did you test this?"

Be honest. Don't claim tests you don't have.

> "Manually, plus throwaway scripts that ran the pipeline against fake MongoDB and BullMQ so I could check the grounding logic — especially that an invented reference actually gets rejected.
>
> I haven't committed a proper test suite, which I know is the biggest gap. What I'd add first is integration tests on the routes using `mongodb-memory-server`, and unit tests on the grounding service, because that's the logic where a silent bug does the most damage."

---

## The curveballs

### Q16. "What was the hardest bug?"

> "The frontend was faking it. There was a function in `App.jsx` that built the itinerary in the browser with a hardcoded loop. It also called the backend, but inside a try/catch that only logged a warning — so the client-side version always won the race and the backend result was never what you saw.
>
> All the queue and WebSocket infrastructure was real and working, but nothing depended on it. I deleted the client-side generator entirely so the UI has no way to produce an itinerary on its own — the only two things that can set that state now are the socket handler and the polling fallback."

### Q17. "What are you most proud of?"

> "The verification layer. It would have been easy to write the prompt saying 'only use these hotels' and call it done. Adding the code that actually checks — and fails the job when the AI invents something — is the difference between hoping it works and knowing it does."

### Q18. "What would you do differently?"

> "I'd have written tests as I went instead of at the end. And I over-built in places — I have a caching layer and provenance tracking that are genuinely useful but that I added before the basics were solid. I'd get the core path working and tested first.
>
> On auth specifically, I'd put the token in an httpOnly cookie with a refresh token rather than localStorage. localStorage is readable by any script on the page, so an XSS bug escalates straight to account takeover. I chose it knowing that — it's simpler and it's what the API-header model expects — but it's the first thing I'd change if this were handling anything that mattered."

### Q19. "Did you use AI to build this?"

Be honest — everyone does, and lying is worse than the answer.

> "Yes, for boilerplate and for reviewing my own architecture. The design decisions are mine and I can defend all of them, which is what matters. Ask me about any file."

**Then be ready to actually explain any file.** That's the real test.

### Q20. "Show me a piece of code you're happy with."

Open `services/itineraryGrounding.service.js` and walk through `ground()`:

> "This takes the AI's response and the catalogue. For each activity it reads the code, checks the format with a regex, and looks it up. If it's not there, that's an invented reference — it records it and nulls the field. Then `assertQuality` throws if there are any invalid references or if grounding is under 50%.
>
> The bit I like is that the resolved data comes from the database, not from the AI. Even if the model transcribed a price wrong while copying from my catalogue, the database value wins."

---

## Quick reference — numbers to know

| Thing | Number |
|---|---|
| Backend files | 36 |
| Backend lines | ~3,300 |
| MongoDB collections | 9 |
| Seeded records | 12,420 |
| Destinations | 171 across 38 countries |
| Generation time | 20–40s |
| Cost per itinerary | ~$0.02–0.05 |
| Cache TTL | 90 days |
| Grounding threshold | 50% minimum |
| Client timeout | 90s |
| Poll interval | 5s |
| Retry attempts | 3, exponential — except 429, which waits the delay the provider asks for |
| bcrypt cost | 12 (~250ms per hash) |
| Token lifetime | 7 days |
| Login rate limit | 10 per IP per 15 min |

---

## Before you walk in

- [ ] Can you draw the request flow on a whiteboard from memory?
- [ ] Can you open any file and say what it does in one sentence?
- [ ] Have you run it end-to-end recently so the demo won't surprise you?
- [ ] Do you have `itineraryGrounding.service.js` ready to show?
- [ ] Can you name three things you'd fix, without hesitating?

**The last one matters most.** Engineers who know their system's weaknesses read as far more senior than engineers who think it's perfect.
