# Authentication — what changed and why

Email + password, bcrypt, JWT. Guests can still browse and generate.

---

## ⚠️ Run this first

Two new packages. Nothing starts without them.

```bash
cd backend
npm install
npm run sync-indexes    # creates the unique index on users.email
npm run dev             # should print nothing about JWT_SECRET
```

`JWT_SECRET` has already been generated and added to `backend/.env`. It is
git-ignored (verified).

---

## The one idea that made this small

Every route already read a single value: **`req.userId`**. That was true back
when identity was just a header. So this milestone changed *how that value is
populated*, not who reads it.

**18 places read `req.userId`. None of them needed editing.**

That's the payoff for the placeholder middleware being one file with one
responsibility, and it's a good thing to say out loud in an interview.

---

## Two kinds of identity

| | Source | `req.userId` | Can reach |
|---|---|---|---|
| **Account** | Verified JWT | Mongo ObjectId | everything they own |
| **Guest** | `x-user-id: guest_...` header | that guest id | anonymous data only |

### Why guest ids are namespaced

This is the security decision worth understanding, because without it the
guest path would be a hole big enough to walk through.

The guest header is client-supplied and trivially forged. If account ids were
also valid header values, anyone could send:

```
x-user-id: 507f1f77bcf86cd799439011     <- someone's real account
```

…and read their trips, favourites and bookings. Real auth on the JWT path
wouldn't matter, because the guest path would still be wide open.

So the two id spaces are made **disjoint**:

```js
const GUEST_ID_PATTERN = /^guest_[A-Za-z0-9]{8,56}$/;
```

A 24-character hex ObjectId can never match that. Account ids come only from a
signature we verified. A forged header can therefore only impersonate another
guest — and guest data is anonymous by definition.

---

## Route guards

Three middlewares, in `middlewares/auth.js`:

| Middleware | Behaviour | Used on |
|---|---|---|
| `attachIdentity` | Resolves identity, **never rejects** | globally |
| `requireAuth` | 401 unless signed in | all 16 library routes, `/me`, persist trip |
| `requireIdentity` | Guests fine, but someone must be identified | generation, checklist, assistant |

`attachIdentity` never rejecting is deliberate — an expired token degrades to
guest browsing instead of a wall of 401s on every screen.

**Generation deliberately allows guests.** A recruiter opening your live link
should see the AI work before being asked to sign up. It still needs *an*
identity, because the finished itinerary is pushed to a per-user socket room.

**One route stays public:** `GET /library/shared/:token`. It's declared *above*
the router-wide `requireAuth` — middleware order is what keeps it public. Move
it below and every share link breaks for anyone not signed in.

---

## Password handling

```js
userSchema.pre('validate', async function (next) {
  if (!this._plainPassword) return next();
  this.passwordHash = await bcrypt.hash(this._plainPassword, 12);
  this._plainPassword = undefined;
  next();
});
```

**`pre('validate')`, not `pre('save')`.** Mongoose runs validation *before*
save hooks. Since `passwordHash` is `required`, hashing in `pre('save')` fails
every registration with "passwordHash is required" — the hook that sets it
hadn't run yet. This cost me a real debugging cycle; it's a good bug to be able
to describe.

**`select: false` on `passwordHash`.** It never comes back from a query unless
explicitly requested. You cannot leak it by accident through `res.json(user)`,
a spread, or a `populate()` elsewhere. Login is the only query that opts in.

---

## Three security details worth knowing by name

**1. Login gives one error for two failures.** Unknown email and wrong password
both return `Invalid email or password.` Otherwise the login form becomes a
tool for checking which of a leaked email list has accounts here.

**2. Login hashes even when the user doesn't exist.** An early return on an
unknown email responds in ~1ms while a real account takes ~250ms. That timing
gap leaks precisely what the identical message was hiding.

**3. The dummy hash is generated, not hardcoded.**

```js
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
```

bcrypt returns `false` *instantly* on a malformed hash. A hand-typed constant
with one wrong character would look correct, pass review, and silently disable
defence #2 entirely. I originally hardcoded one — the timing test caught it.

Plus: login is rate limited to 10 attempts per IP per 15 minutes. Partly
brute-force protection, partly because bcrypt is expensive on purpose, so
parallel guesses are also a CPU denial-of-service against us.

---

## The socket, and the attack it prevents

Finished itineraries are emitted to `user_<id>`. Whoever controls the id
controls whose results they receive.

Locking down HTTP while leaving the handshake trusting its payload would
achieve nothing — an attacker would simply connect claiming your id and collect
your itineraries as they generated. The handshake now runs the same check as
HTTP and takes the account id from the verified `sub` claim, never from the
payload.

The frontend reconnects the socket when identity changes. Without that, signing
in on an open tab leaves the socket in the old guest room while the API
generates under the account id — the itinerary completes and is delivered to a
room nobody is listening in.

---

## Frontend

| File | What it does |
|---|---|
| `hooks/useAuth.jsx` | Holds the user; validates the stored token via `/me` on mount |
| `components/AuthModal.jsx` | Sign in / create account, one modal, two modes |
| `App.jsx` → `AccountMenu` | Sign-in button, or avatar + sign out |
| `utils/identity.js` | Guest id **and** token storage |
| `api/client.js` | Attaches `Authorization`; raises one event on session expiry |

**A stored token is not proof of anything** — it may be expired, or belong to a
deleted account. So on mount we call `/me` and only a successful response makes
someone signed in. That round trip is why `loading` exists.

### Two bugs caught while wiring this up

**The modal opened on every page load.** `LibraryProvider` fetches favourites on
mount; that route now requires an account; the 401 interceptor opened the
sign-in modal. Every guest, every load. Fixed twice over — the interceptor only
fires when a token was actually *sent* (session expired, not "guest touched an
account route"), and `LibraryProvider` doesn't fetch at all when signed out.

**A public `POST /api/v1/services/book`** replied "Booking confirmed
successfully!" with a random reference and saved nothing. Dead code — the real
endpoint is `POST /library/bookings` — but it was an open endpoint telling
anyone who found it that their booking had succeeded. Deleted.

---

## Verification

**129 checks, all passing.** The npm registry is unreachable from my sandbox, so
`jsonwebtoken` and `bcryptjs` were exercised through stand-ins — the JWT one is
a real HS256 implementation using `crypto.createHmac`, so signature tampering
genuinely fails rather than being assumed to.

| Suite | Checks | Covers |
|---|---|---|
| JWT + middleware | 42 | tampering, expiry, wrong secret, wrong issuer, forged headers |
| User model | 26 | hook ordering, `select: false`, salting, validation |
| Auth service | 26 | duplicates, enumeration, **timing**, mass assignment |
| Route guards | 15 | every route's guard, asserted from the live Express stack |
| Socket + rate limit | 20 | room isolation, impersonation, window reset |

The route-guard suite walks the actual Express middleware stack rather than
reading the source, so it catches a guard applied in the wrong order — which is
exactly how the public share link would break.

---

## Known limitation

The token lives in **localStorage**, so any script running on the page can read
it: an XSS bug becomes account takeover. The stronger design is an httpOnly
cookie plus refresh-token rotation.

This was a deliberate trade for simplicity, and being able to say *why* you
chose it usually scores as well as having built the harder one.
