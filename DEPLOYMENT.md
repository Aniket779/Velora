# Deploying Velora

Free tier throughout. Budget about 45 minutes the first time.

**The order matters.** Each step needs a URL or credential from the one before,
so doing them out of sequence means going back and redeploying.

```
Atlas (database)  ->  Render (API)  ->  Vercel (frontend)  ->  back to Render (CORS)
```

That last hop is not a mistake. The API needs the frontend's URL to allow it
through CORS, and that URL doesn't exist until Vercel has deployed.

---

## Before you start

- [ ] `npm run build` succeeds in `frontend/` — **do this first**, a build error
      is much easier to read locally than in a Vercel log
- [ ] Everything is committed (`git status` is clean)
- [ ] You have your Upstash Redis credentials to hand

```bash
cd frontend && npm run build      # must succeed before you push
cd .. && git push origin main
```

---

## Step 1 — MongoDB Atlas (10 min)

1. Create a free **M0** cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
   Pick the region closest to you.
2. **Database Access** → Add New Database User. Username and password,
   built-in role **Read and write to any database**.
   - Use a password with no special characters. It saves you URL-encoding it
     later, and a mis-encoded `@` is a genuinely annoying hour to debug.
3. **Network Access** → Add IP Address → **Allow Access From Anywhere**
   (`0.0.0.0/0`).
   - Render assigns dynamic outbound IPs on the free tier, so an allowlist of
     specific addresses will break at some point without warning. **This is the
     single most common cause of a failed deploy.**
4. **Connect** → Drivers → copy the connection string.

Then edit it — the copied string is not quite usable:

```
mongodb+srv://velora:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
                                                         ^
                                          add the database name here
```

```
mongodb+srv://velora:PASSWORD@cluster0.xxxxx.mongodb.net/Velora?retryWrites=true&w=majority
```

Without `/Velora`, Mongo silently uses a database called `test` and your seeded
data lands somewhere you'll never look.

### Seed it from your machine

Point your local `.env` at Atlas temporarily and run the seeder:

```bash
cd backend
# temporarily set MONGO_URI in .env to the Atlas string
npm run seed            # ~30s, writes 12,420 records
npm run sync-indexes    # creates the indexes, including users.email
```

Doing this locally rather than on Render means you can watch it and you aren't
burning free-tier build minutes.

> **If you see `querySrv ECONNREFUSED`** — DNS on your machine, not Atlas.
> Don't go looking at the IP allowlist.
>
> `mongodb+srv://` resolves an SRV record before it connects. Node does that
> lookup itself rather than deferring to the OS, so `nslookup` can succeed
> while Node fails on the same network. The usual cause is the machine having
> only an IPv6 link-local nameserver (`fe80::...`) — `nslookup` handles the
> interface scope those require, Node generally can't.
>
> Fix: add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `backend/.env`. Alternatively use
> **Connect → Drivers → Version `2.2.12 or later`** for a `mongodb://` string
> with the hosts written out, which skips the SRV lookup entirely.
>
> Render's DNS is fine, so this only ever affects seeding from your machine.

---

## Step 2 — Render, the API (15 min)

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect the GitHub repo.
3. Settings:

   | Field | Value |
   |---|---|
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm ci` |
   | Start Command | `npm start` |
   | Instance Type | Free |
   | Health Check Path | `/health` |

   **Root Directory `backend` matters.** Leave it blank and Render runs `npm ci`
   at the repo root, finds no `package.json`, and fails.

4. **Environment** → add these:

   ```
   NODE_ENV        production
   MONGO_URI       <your Atlas string, with /Velora>
   REDIS_HOST      <name>.upstash.io
   REDIS_PORT      6379
   REDIS_PASSWORD  <upstash password>
   GEMINI_API_KEY  <your key>
   GEMINI_MODEL    gemini-3.1-flash-lite
   JWT_SECRET      <generate a NEW one, see below>
   JWT_EXPIRES_IN  7d
   CLIENT_URL      http://localhost:5173
   ```

   Generate a production secret — **do not reuse your local one**, so a leaked
   dev secret can't forge production tokens:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   `CLIENT_URL` is a placeholder for now. Step 4 fixes it.

5. Deploy. Watch the log for:

   ```
   [DB] Connected to Velora
   [AI] Provider: gemini (gemini-3.1-flash-lite)
   [Server] Listening on 10000 (production)
   ```

6. Check it:

   ```bash
   curl https://your-service.onrender.com/health
   # {"status":"ok","db":"connected","ai":"gemini",...}
   ```

   **On Windows PowerShell**, `curl` is an alias for `Invoke-WebRequest` and
   will warn about script execution. Use one of these instead:

   ```powershell
   curl.exe https://your-service.onrender.com/health   # the real curl binary
   irm https://your-service.onrender.com/health        # native, parses the JSON
   ```

   If `db` says `disconnected`, go back to Atlas Network Access. The first
   request can take ~50s if the free instance has gone to sleep.

---

## Step 3 — Vercel, the frontend (10 min)

1. [vercel.com/new](https://vercel.com/new) → import the repo.
2. Settings:

   | Field | Value |
   |---|---|
   | Framework Preset | Vite |
   | Root Directory | `frontend` |
   | Build Command | `npm run build` (default) |
   | Output Directory | `dist` (default) |

3. **Environment Variables** → add:

   ```
   VITE_API_URL = https://your-service.onrender.com
   ```

   No trailing slash. Vite bakes this into the bundle **at build time**, so
   changing it later requires a redeploy — editing it in the dashboard alone
   does nothing.

4. Deploy, then copy your URL (e.g. `https://velora.vercel.app`).

`vercel.json` is already in the repo. It rewrites all paths to `index.html`,
which is what stops `/library`, `/trip/:id` and `/shared/:token` from 404ing
when someone refreshes or opens a shared link directly.

---

## Step 4 — Close the loop (2 min)

Back in Render → Environment → update:

```
CLIENT_URL = https://velora.vercel.app,http://localhost:5173
```

Comma-separated, no trailing slashes. Keeping localhost means you can still
develop against the deployed API.

Render redeploys automatically. Until this step, every request from your live
frontend fails CORS — the page loads and nothing works, which looks far more
alarming than it is.

---

## Step 5 — Keep it awake (3 min)

Render's free tier sleeps after 15 minutes idle. The next visitor waits ~50
seconds, and a recruiter will usually close the tab first.

1. [cron-job.org](https://cron-job.org) or UptimeRobot → free account
2. URL: `https://your-service.onrender.com/health/live`
3. Schedule: **every 10 minutes**
4. Save and enable.

Ten minutes, not fifteen — you want the ping comfortably inside the window.

**Point monitors at `/health/live`, not `/health` or `/`.** The service exposes
three endpoints and they answer different questions:

| Endpoint | Answers | Fails when | Use it for |
|---|---|---|---|
| `/` | what is this service? | never | humans, curiosity |
| `/health/live` | is the process alive? | never (200 while responding) | **uptime monitors** |
| `/health` | can it serve traffic? | 503 if Mongo is down | **Render health check** |

A monitor pointed at `/health` will report DOWN during a 30-second Atlas blip,
even though the process is fine and recovering by itself. A monitor pointed at
`/` used to report DOWN permanently, because the root route 404'd.

> Render's free tier also caps total monthly runtime. A keep-alive ping consumes
> those hours continuously, so the service may exhaust its allowance near the end
> of a heavy month. If the link must never be down, that's the case for the $7 plan.

---

## Verify the deployment

Open your Vercel URL and walk the whole path:

- [ ] Landing page loads, destination cards show real images
- [ ] **Create an account** → header shows your name
- [ ] **Hard-refresh** → still signed in
      *(proves token storage, the Authorization header, CORS and `/me` all work)*
- [ ] Generate a Goa trip → tabs show **Hotels (12)**, not (0)
- [ ] Itinerary shows the green **"verified from database"** badge
- [ ] Share a trip, then **open the link in a private window**
      *(this is the SPA-rewrite check — a 404 here means `vercel.json` didn't apply)*
- [ ] Sign out → generate a trip as a guest → still works
- [ ] As a guest, click a heart → sign-in prompt appears

---

## When something breaks

| Symptom | Cause | Fix |
|---|---|---|
| `querySrv ECONNREFUSED` when seeding | **DNS on your machine** — Node can't reach the nameserver, often an IPv6 link-local one. `nslookup` working proves nothing | `DNS_SERVERS=8.8.8.8,1.1.1.1` in `backend/.env` |
| `db: disconnected` on /health | Atlas IP allowlist | Network Access → `0.0.0.0/0` |
| Page loads, every request fails | `CLIENT_URL` not updated | Step 4 |
| Deep links 404 on refresh | `vercel.json` not applied | Root Directory must be `frontend` |
| `JWT_SECRET must be set...` | Missing or under 32 chars | Regenerate, redeploy |
| Requests go to `localhost:5000` | `VITE_API_URL` set after build | Redeploy — Vite inlines at build time |
| Socket never connects, polls instead | Socket.io CORS | Same `CLIENT_URL` fix, check the browser console |
| First load takes ~50s | Free tier cold start | Step 5 |
| `Cannot find module 'bcryptjs'` | Stale lockfile | `npm install` locally, commit `package-lock.json` |
| 429 `limit: 0` on generate | That model has no free-tier quota | `npm run check-ai` locally — it names one that does |
| 429 with a real limit (e.g. 15) | Genuine throttling | Wait, or pick a model with higher throughput |

**Render logs are the first place to look**, not the browser. Dashboard →
your service → Logs.

---

## Then update your README

A live link at the top is worth more than any feature you could add next.

```markdown
**[Live demo](https://velora.vercel.app)** · [Architecture](ARCHITECTURE.md)
```

Add four screenshots — search, generated itinerary, destination guide, library.
Most people who see your project will never clone it; the README *is* the
project to them.
