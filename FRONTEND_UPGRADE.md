# Frontend Upgrade — Premium Pass

**112 checks passing** (46 frontend, 47 dataset, 19 pipeline). No backend changes.

The existing dark glassmorphism look was kept and refined rather than replaced.
Nothing was redesigned for its own sake — every change either fixes something
broken or sharpens something that already worked.

---

## The honest headline

Three things in the UI were **lying to users**. Those are fixed first, because
polish on top of dishonest UI is worse than no polish.

| Was | Now |
|---|---|
| Filter sidebar: 11 checkboxes with `defaultChecked` and **no `onChange`**. Clicking did nothing. | Real filters — price slider, rating, stops, amenities, cuisine, category. Every option is derived from the actual results and shows a match count. |
| Booking modal **fabricated a successful booking** when the API failed — fake reference number, "Booking Confirmed!", nothing persisted anywhere. | A failure shows a failure, with retry. Success is labelled "Demo booking — no payment was taken." |
| A failed fetch and an empty result looked **identical** ("Available Flights (0)"). | Distinct `EmptyState` and `ErrorState`, the latter with a retry button. |

---

## Design system

`index.css` rebuilt around tokens rather than ad-hoc values.

- **Motion tokens** (`--dur-fast/base/slow`, `--ease-out/spring`) so every
  transition is consistent and tunable from one place
- **Elevation scale** replacing scattered one-off `box-shadow` values
- **Contrast fixed** — `--text-muted` was `#64748b`, roughly 4.0:1 on the page
  background, which fails WCAG AA for body text. Raised to pass 4.5:1.
- **Real focus ring** — the old CSS set `outline: none` on inputs with no
  replacement, so keyboard users had *no visible focus anywhere*. Now a
  `:focus-visible` ring that mouse users never see.
- **`prefers-reduced-motion`** — the infinite `pulse-glow` and floating orbs are
  vestibular triggers and now stop entirely, not just shorten.

## Cards

`components/cards.jsx` — one definition each for hotel, flight, restaurant,
place and cab, used by **both** the browse tabs and the itinerary view.

Previously hotel and flight cards were written twice with different markup and
different field names. That's why the code was full of
`hotel.hotelName || hotel.name` — the two API shapes disagreed and each copy
compensated differently. Normalising once removed the duplication *and* the
fallbacks, and deleted three component files.

Visual work: lazy-loaded images with a working `onError` fallback, staggered
entry animation, a hover sheen that sweeps across the card, rating pills,
amenity tags with overflow counts, and a proper flight route visual.

## Filters & sorting

`hooks/useFilterSort.js` + `components/FilterSort.jsx`.

- Facets are **derived from the current results**, so the UI never offers a
  filter that would return nothing
- Each option shows how many items match
- Price slider bounded by the real min/max of what's on screen
- Sort options are per-tab: flights get Cheapest/Fastest/Earliest, hotels get
  Top rated/Price, and so on
- Result count shows "12 results — filtered from 30" with a one-click clear

Filtering runs client-side over the current page. That's the honest scope: fast,
no API changes, right for 30 results. Server-side filtering across all 12,420
records is the next step.

## Accessibility

From **8 ARIA attributes to 105**.

- Tabs are real `role="tablist"` with `aria-selected`, roving tabindex and
  **arrow-key navigation** — previously plain buttons a screen reader announced
  as four unlabelled controls
- Both modals: `role="dialog"`, `aria-modal`, **focus trap**, **Escape to
  close**, focus restored to the trigger. The VR viewer was the worst case — a
  full-viewport overlay a keyboard user could not escape from.
- `aria-live` regions so loading and results are announced
- Every icon-only button labelled; every decorative icon `aria-hidden`
- Skip-to-content link

## Responsive

Two breakpoints became five, plus a `pointer: coarse` block for 44×44px touch
targets.

The specific fixes: cards stack with full-width media, the flight route
compresses, the header drops the currency chip below 480px, the assistant
collapses to an icon, and the **VR info panel becomes a bottom sheet** instead
of a 450px card covering the whole phone screen.

## Everything else

- **Landing hero** — the app previously opened straight onto a tab bar with no
  explanation. Leads with the actual differentiator, collapses once you search.
- **Map** — dark CARTO tiles instead of a bright white rectangle in a dark UI;
  bounds fitted to all markers instead of a hardcoded zoom on the first item;
  colour-coded pins; themed popups; scroll-wheel zoom disabled so it stops
  hijacking page scroll.
- **Loading** — skeletons matched to real card shapes, plus a progress bar
  driven by the worker's actual job progress and a live/degraded connection
  indicator.
- **Itinerary page** — four near-identical inventory sections collapsed into one
  `InventorySection`. This also fixed a real bug: Hotels and Sightseeing shared
  a single `viewMode`, so switching one to map view silently switched the other.

---

## Files

**New (6)** — `components/{Hero,cards,states,FilterSort}.jsx`,
`hooks/{useFilterSort,useModalA11y}.js`

**Rewritten (7)** — `index.css`, `App.jsx`, `components/{BookingModal,MapView,VRDestinationModal,ServiceTabs}.jsx`

**Deleted (4)** — `App.css` (unused Vite template),
`components/{HotelBooking,FlightBooking,CabBooking}.jsx` (superseded by `cards.jsx`)

Net: 20 files, 4,594 lines. `App.jsx` dropped from 472 to ~380 despite gaining
filters, sorting, error boundaries and progress tracking.

---

## What I did NOT do

Deliberate scope limits, per "don't unnecessarily redesign":

- The visual language is unchanged — same dark glassmorphism, same accent
  colours, same fonts
- No CSS framework or component library added
- No routing changes (still a single route)
- No state management library
- Inline styles remain where they're one-off; only repeated patterns moved to CSS

## Still open

- **Server-side filtering and pagination** — currently client-side over the
  loaded page
- **Dates are still ignored** in flight search; flights are route templates
  with no date field
- **No component tests** — verification is static analysis, not rendered DOM
- **Light mode** — the app is dark-only. You asked for dark mode *polish*, so I
  refined the dark theme rather than adding a second one.

### Verify it yourself

```bash
cd backend && npm run seed && npm run dev
cd frontend && npm run dev
```

Then: Tab through the whole page and confirm focus is always visible. Open the
booking modal and press Escape. Turn on reduced motion in your OS and reload.
Resize to 375px. Stop the backend and confirm you get a retry button, not an
empty list.
