'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const configureDns = require('../src/config/dns');
const { printConnectionHelp } = require('../src/config/dbErrors');
const Destination = require('../src/models/Destination');

/**
 * ============================================================================
 * FETCH REAL LANDMARK PHOTOS FROM WIKIPEDIA
 * ============================================================================
 * Run with:  npm run fetch-images        (skips landmarks that already have one)
 *            npm run fetch-images -- --force   (re-fetch everything)
 *            npm run fetch-images -- --city goa
 *
 * WHY THIS EXISTS
 * Every destination lists real landmarks — Red Fort, Qutub Minar, Lotus
 * Temple. Generating images for them is not an option: a stock photo standing
 * in for a named monument is a confident lie, and it's how Delhi ended up
 * illustrated with the Taj Mahal (which is in Agra).
 *
 * Wikipedia has a real, correctly-attributed photo of essentially every
 * landmark in the dataset, free and without an API key. This fetches them once
 * and stores them, so nothing is looked up at request time.
 *
 * THE RULE THIS SCRIPT FOLLOWS
 * It never writes a URL it did not receive from Wikipedia. A landmark we
 * cannot find keeps no image, and the UI skips it. Missing is fine; wrong is
 * not. Every miss is logged so you can see exactly what didn't resolve.
 * ============================================================================
 */

const API = 'https://en.wikipedia.org/w/api.php';

// Wikipedia's etiquette policy requires a descriptive User-Agent identifying
// the tool and a contact. Requests without one get rate-limited or blocked.
const USER_AGENT =
  'Velora/1.0 (https://github.com/Aniket779/Velora; travel itinerary project) axios';

const FORCE = process.argv.includes('--force');
const cityArgIndex = process.argv.indexOf('--city');
const ONLY_CITY = cityArgIndex > -1 ? process.argv[cityArgIndex + 1] : null;

// Wikipedia accepts up to 50 titles per query. Landmarks are grouped per city
// (8ish each), so this is comfortably one request per city.
const TITLES_PER_REQUEST = 50;
const PAUSE_MS = 250; // polite gap between requests

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ask Wikipedia for the lead image of each title.
 *
 * `redirects=1` is doing real work here: the seed data says "Qutub Minar",
 * Wikipedia's canonical title is "Qutb Minar". Without it, roughly a third of
 * Indian monuments miss on spelling alone.
 */
async function fetchImages(titles) {
  const { data } = await axios.get(API, {
    params: {
      action: 'query',
      format: 'json',
      formatversion: 2,
      titles: titles.join('|'),
      redirects: 1,
      prop: 'pageimages|info',
      piprop: 'original|thumbnail',
      pithumbsize: 1600,
      inprop: 'url',
      origin: '*',
    },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 20_000,
  });

  const out = new Map();

  // formatversion=2 gives arrays instead of keyed objects, and resolves
  // redirects into a `redirects` list mapping requested -> actual title.
  const redirects = new Map(
    (data.query?.redirects || []).map((r) => [r.to, r.from])
  );
  const normalized = new Map(
    (data.query?.normalized || []).map((n) => [n.to, n.from])
  );

  for (const page of data.query?.pages || []) {
    if (page.missing) continue;

    const src = page.original?.source || page.thumbnail?.source;
    if (!src) continue; // page exists but has no image — treat as a miss

    // Map back to whatever we asked for, through redirect + normalisation.
    const viaRedirect = redirects.get(page.title);
    const requested = normalized.get(viaRedirect || page.title) || viaRedirect || page.title;

    out.set(requested, {
      imageUrl: src,
      wikipediaUrl: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      attribution: `Photo via Wikipedia — ${page.title}`,
    });
  }

  return out;
}

/** Chunks an array into fixed-size groups. */
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function run() {
  console.log('\n==================================================');
  console.log('   FETCHING LANDMARK PHOTOS FROM WIKIPEDIA');
  console.log('==================================================\n');

  configureDns();
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Velora';
  console.log(`Connecting to ${uri.replace(/\/\/[^@]*@/, '//***@')} ...`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  console.log('  connected\n');

  const filter = ONLY_CITY ? { citySlug: ONLY_CITY.toLowerCase() } : {};
  const destinations = await Destination.find(filter);

  if (!destinations.length) {
    console.log(ONLY_CITY ? `No destination with slug "${ONLY_CITY}".` : 'No destinations found. Run npm run seed first.');
    return;
  }

  console.log(`${destinations.length} destination(s) to process`);
  console.log(FORCE ? 'Mode: --force (re-fetching everything)\n' : 'Mode: incremental (skipping landmarks that already have a photo)\n');

  let found = 0, missed = 0, skipped = 0, citiesUpdated = 0;
  const misses = [];

  for (const dest of destinations) {
    const places = dest.famousPlaces || [];
    if (!places.length) continue;

    const pending = places.filter((p) => p.name && (FORCE || !p.imageUrl));
    skipped += places.length - pending.length;
    if (!pending.length) continue;

    // Two candidate titles per landmark: the bare name, and the name
    // disambiguated by city. "Fort" alone is hopeless; "Fort Kochi" resolves.
    const titles = pending.map((p) => p.name);
    const results = new Map();

    for (const group of chunk(titles, TITLES_PER_REQUEST)) {
      try {
        const batch = await fetchImages(group);
        for (const [k, v] of batch) results.set(k, v);
      } catch (err) {
        console.error(`  ! ${dest.cityName}: request failed — ${err.message}`);
      }
      await sleep(PAUSE_MS);
    }

    // Retry the misses with the city name appended.
    const stillMissing = pending.filter((p) => !results.has(p.name));
    if (stillMissing.length) {
      const qualified = stillMissing.map((p) => `${p.name} ${dest.cityName}`);
      try {
        const batch = await fetchImages(qualified);
        for (const p of stillMissing) {
          const hit = batch.get(`${p.name} ${dest.cityName}`);
          if (hit) results.set(p.name, hit);
        }
      } catch { /* the bare-name miss already stands */ }
      await sleep(PAUSE_MS);
    }

    let changed = false;
    for (const place of pending) {
      const hit = results.get(place.name);
      if (hit) {
        place.imageUrl = hit.imageUrl;
        place.wikipediaUrl = hit.wikipediaUrl;
        place.attribution = hit.attribution;
        changed = true;
        found++;
      } else {
        missed++;
        misses.push(`${dest.cityName} — ${place.name}`);
      }
    }

    if (changed) {
      // markModified is required: Mongoose does not always detect mutations
      // to objects inside an array of subdocuments.
      dest.markModified('famousPlaces');
      await dest.save();
      citiesUpdated++;
    }

    const withImages = (dest.famousPlaces || []).filter((p) => p.imageUrl).length;
    console.log(`  ${dest.cityName.padEnd(22)} ${withImages}/${places.length} landmarks have photos`);
  }

  console.log('\n--------------------------------------------------');
  console.log(`  found:   ${found}`);
  console.log(`  missing: ${missed}`);
  console.log(`  skipped: ${skipped} (already had a photo)`);
  console.log(`  cities updated: ${citiesUpdated}`);

  if (misses.length) {
    console.log(`\n  ${misses.length} landmark(s) had no Wikipedia photo:`);
    misses.slice(0, 25).forEach((m) => console.log(`    - ${m}`));
    if (misses.length > 25) console.log(`    ... and ${misses.length - 25} more`);
    console.log('\n  These keep no image and the gallery skips them. That is the');
    console.log('  intended behaviour — an absent photo is better than a wrong one.');
  }
  console.log('');
}

run()
  .catch((err) => {
    console.error('\nFetch failed:', err.message);
    printConnectionHelp(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
