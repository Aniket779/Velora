# Next Steps

Ordered by value. Stop after Phase 2 and you have a strong placement project.

---

## Phase 1 — Make it actually run (15 minutes) 🔴 DO THIS NOW

Your database is empty. That's why every tab showed `(0)`.

```bash
cd backend
npm run seed            # 171 destinations, 12,420 records — takes ~30s
npm run sync-indexes    # drops the broken shareToken index
npm run dev             # look for: [AI] Provider: gemini (gemini-2.0-flash)
```

```bash
cd frontend
npm run dev
```

**Then verify these five things.** If any fail, tell me which:

- [ ] Generate a Goa trip → tabs show **Hotels (12)**, **Restaurants (13)**, not (0)
- [ ] Itinerary shows a green **"verified from database"** badge
- [ ] Hotel names are real records like "Hotel Sagar Anjuna Beach Retreat — ₹3,750/night"
- [ ] **My Library** → your trip is in Trip History
- [ ] **Ask Velora** → "What can I do in Goa?" returns real place names

### If you see "rate limited"

Not a bug. Gemini's free tier allows ~15 requests/minute, and the **first** trip
to a new city costs 2 calls (city briefing + itinerary). Every later trip to
that city costs 1 — the briefing is cached in MongoDB for 90 days.

Wait ~60s and press Retry. If it keeps happening, put this in `backend/.env`:

```
GEMINI_MODEL=gemini-2.0-flash-lite   # 30 req/min instead of 15
```

Seed the briefings once up front and normal use never touches the limit.

---

## Phase 2 — Make it presentable (one weekend) 🟠 HIGHEST ROI

### 1. Deploy it
Worth more than any feature you could add. A live link is the single biggest
credibility multiplier on your CV.

- Backend + worker → **Render** (free tier)
- Frontend → **Vercel** (free tier)
- MongoDB → **Atlas** free cluster (you're already on Upstash for Redis)
- Set `VITE_API_URL` on Vercel to your Render URL

### 2. Screenshots in the README
Most people never clone the repo. The README **is** your project to them.
Four images: search form, generated itinerary, destination guide, library.

### 3. Clean the git history
`git log --oneline` should read like deliberate work, not `fix`, `fix2`, `final`.

### 4. Record a 60-second demo
Screen recording, no narration needed. Link it at the top of the README.

---

## Phase 3 — Close the honest gaps (a week each) 🟡 ONLY IF TIME

> ✅ **Authentication is done** (bcrypt + JWT, guest browsing preserved).
> Run `cd backend && npm install` before starting — it needs two new packages.

### A few tests
You don't need full coverage. Four or five integration tests on the routes
means you can say "tested" honestly instead of explaining why you didn't.
Start with `itineraryGrounding.service` — that's where a silent bug hurts most.

### Worker in its own process
Right now it shares the API's event loop. It's your best scaling answer in an
interview, and the fix is genuinely small. See roadmap M10.

---

## What NOT to do

- ❌ Don't add more features. You have 15. Depth beats breadth now.
- ❌ Don't rewrite anything that works.
- ❌ Don't chase 100% test coverage.
- ❌ Don't add TypeScript this close to interviews.

---

## Before an interview

Read **INTERVIEW_PREP.md** — 20 questions with answers.

The three that matter most:

1. **"How do you stop the AI hallucinating?"** — retrieval + verification, and
   you *reject* plans that reference invented venues.
2. **"What breaks at 1M users?"** — worker shares the event loop; no Socket.io
   Redis adapter. Knowing your own weaknesses reads as senior.
3. **"Walk me through a bug you found."** — the `shareToken` one is perfect:
   `unique + sparse + default: null` looks correct and silently breaks on the
   second row.

Be ready to open any file and say what it does. **ARCHITECTURE.md** has a
one-line description of every one.
