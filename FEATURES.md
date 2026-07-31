# Feature Build — 15 Features

**135 checks passing** (88 features, 47 dataset). All 15 features implemented.

---

## The architectural decision

Fifteen features could have meant fifteen subsystems. They didn't, because most
of them are variations on **two primitives**:

**"Remember what the user did"** — Saved Trips, Trip History, Favorites,
Recently Viewed, Booking History are all *"rows belonging to a user, newest
first"*. They share one service (`library.service.js`) and two collections.

**"Find things near a point"** — Nearby Hotels, Nearby Restaurants, Nearby
Attractions are one geo query with a type parameter. One method, one endpoint,
one UI component with tabs.

Net cost: **9 new backend files, 8 new frontend files** for 15 features.

---

## What each feature is, and where it lives

| Feature | Implementation |
|---|---|
| **Saved Trips** | `Itinerary.isSaved` + `library.listTrips({saved:true})` |
| **Trip History** | `Itinerary.ownerId` + `library.listTrips()` |
| **Favorites** | `UserActivity{kind:'favorite'}`, hearts on every card |
| **Recently Viewed** | `UserActivity{kind:'recently_viewed'}`, upsert so re-viewing reorders |
| **Booking History** | New `Booking` collection — previously nothing was persisted at all |
| **Trip Sharing** | `Itinerary.shareToken`, public `/shared/:token` route |
| **Budget Calculator** | Median prices from **real inventory** in that city |
| **Weather Forecast** | Climate normals from the destination briefing — *see caveat below* |
| **Nearby Attractions** | `$nearSphere` + 2dsphere index |
| **Nearby Restaurants** | same query, `types=restaurant` |
| **Nearby Hotels** | same query, `types=hotel` |
| **Travel Checklist** | Generated from briefing + traveller profile, state on the itinerary |
| **Interactive Maps** | `MapView` reused in itinerary, nearby and destination pages |
| **Personalized Recommendations** | Signals: favourites → recent views → past trip interests |
| **AI Travel Assistant** | Retrieval-grounded chat over the user's own data + inventory |

---

## Three things worth calling out

### The weather feature is not a forecast, and says so

There is no live weather API wired up. `discover.weather()` returns **climate
normals** — what conditions are typically like in a given month — derived from
the cached destination briefing.

The response carries `isForecast: false`, and the UI reads *"Typical conditions
for this month, not a live forecast. Check a weather service near your travel
date."* Calling monthly averages a forecast would be a lie someone might pack
based on.

### Booking prices are now server-derived

The old endpoint took `amount` from the request body and echoed it back, so a
client could book a ₹50,000 flight for ₹1. `createBooking` now looks the item up
by id and uses **its** stored price. The frontend doesn't even send an amount.

### The assistant follows the same grounding pattern as itinerary generation

It's not a generic chatbot. Given a message it: detects intent, resolves which
of our 171 real cities is being discussed, retrieves that city's inventory plus
the user's own trips/favourites/bookings, and answers **from that data** with an
explicit instruction to say "I don't have that" rather than invent.

Replies carry a `grounded` flag, and the UI shows *"answered from database
records"* when true. Without an API key it still works — retrieval runs and a
deterministic summary is returned, clearly labelled.

---

## Two real bugs the tests caught

**Month ranges never matched.** `discover.weather()` checked whether the range
string `"Nov-Feb"` *contained* `"Dec"`. It doesn't — so every winter month was
reported as off-season for a destination whose peak season is winter. Fixed with
proper range expansion that wraps across the year boundary. Ten regression cases
now cover it.

**Recommendations could return an empty panel.** A user who had viewed every
destination got nothing, because the query excluded everything they'd seen and
the fallback excluded them too. Now widens in stages and, as a last resort, shows
popular destinations even if already seen. An empty panel is worse than a
familiar one.

---

## How it connects

The features aren't parallel — they feed each other:

```
View a destination
      └─> recorded in Recently Viewed
              └─> feeds Personalized Recommendations
Favourite a hotel
      └─> visible on every card everywhere (shared context)
              └─> feeds Recommendations ("cities you favourited things in")
Generate a trip
      └─> appears in Trip History automatically (ownerId)
              └─> can be Saved, Shared, given a Checklist
                      └─> Book from inside it -> Booking History
The Assistant reads all of the above.
```

`LibraryProvider` is the connective tissue on the frontend: favourite state is
fetched **once** into a Set, so any card can ask `isFavorite('hotel', id)` in
O(1), and toggling in one place updates every card showing that item. Toggles are
optimistic with rollback — a heart that takes 300ms to fill feels broken.

---

## New API surface

```
GET    /library/overview                    counts for nav badges
GET    /library/trips?saved=true            history / saved
PATCH  /library/trips/:id/save|title
DELETE /library/trips/:id
POST   /library/trips/:id/share             -> unguessable token
DELETE /library/trips/:id/share             revoke
GET    /library/shared/:token               PUBLIC, owner identity stripped
GET    /library/favorites[/ids]
POST   /library/favorites/toggle
GET    /library/recently-viewed
POST   /library/recently-viewed
GET    /library/bookings
POST   /library/bookings                    price derived server-side
PATCH  /library/bookings/:id/cancel

GET    /discover/nearby?lat=&lng=&radiusKm=&types=
GET    /discover/weather/:citySlug?month=
GET    /discover/budget/:citySlug?days=&travellers=&budgetTier=
GET    /discover/checklist/:itineraryId
POST   /discover/checklist/:itineraryId
PATCH  /discover/checklist/:itineraryId/:itemId
GET    /discover/recommendations
POST   /discover/assistant/chat
```

New frontend routes: `/library`, `/trip/:id`, `/shared/:token`,
`/destination/:citySlug`

---

## Files

**Backend new (9)** — `models/{UserActivity,Booking}.js`,
`services/{library,discover,assistant}.service.js`,
`controllers/{library,discover}.controller.js`,
`routes/{library,discover}.routes.js`

**Backend changed (6)** — `models/{Hotel,Restaurant,TouristPlace}.js` (GeoJSON +
2dsphere), `models/Itinerary.js` (ownerId, isSaved, shareToken, checklist),
`ai/openai.js` (chat method), `server.js`, worker + repository (ownership)

**Frontend new (8)** — `api/client.js`, `hooks/useLibrary.js`,
`components/{planning,discover}.jsx`,
`pages/{Library,TripPage,DestinationPage}.jsx`

**Frontend changed (4)** — `App.jsx` (routes + provider), `cards.jsx` (favourite
buttons), `BookingModal.jsx` (persisted bookings), `FloatingAIAssistant.jsx`
(real API)

---

## Ownership requires a migration

`Itinerary.ownerId` is now **required**. Itineraries generated before this change
have no owner and won't appear in anyone's history.

```js
// one-off, in mongosh
db.itineraries.updateMany({ ownerId: { $exists: false } }, { $set: { ownerId: 'legacy' } })
```

Or just re-seed and regenerate — simpler if you have no data worth keeping.

**Re-seed is required regardless** — the GeoJSON `location` field is new, and
without it every "nearby" query returns nothing:

```bash
npm run seed
```

---

## Still open

- **No authentication.** Identity is still the `x-user-id` header. Every
  ownership check is in place and working, but the identity itself is
  client-asserted. This is now the single most important gap: sharing, saving
  and booking all assume the user is who they say they are.
- **Cab bookings** throw a clear "not available yet" — cabs are a fixed demo
  array with no collection behind them.
- **Assistant has no tool-calling** — it retrieves once, then answers. It can't
  iteratively refine ("find something cheaper").
- **No live weather.** See above.
- **Verification is service-level**, driven through an in-memory MongoDB
  stand-in. There's no live Mongo in this environment, so the geo `$nearSphere`
  path in particular needs one real run against a seeded database.
