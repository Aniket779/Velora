'use strict';

/**
 * ============================================================================
 * VELORA DATABASE SEEDER
 * ============================================================================
 * Run with:  npm run seed
 *
 * WHAT IT DOES
 *   1. Connects to MongoDB
 *   2. Wipes the inventory collections (NOT users/trips/itineraries)
 *   3. Generates hotels, restaurants, attractions and flights for every
 *      destination in seed/data/
 *   4. Inserts them in batches
 *   5. Builds the indexes defined on the models
 *   6. Verifies a real query actually uses an index
 *
 * ABOUT THE DATA — read this before telling anyone it is real
 *   The DESTINATIONS are factual: real cities, real coordinates, real IATA
 *   airport codes, real attractions, real regional dishes.
 *   The BUSINESSES are procedurally generated: hotel and restaurant names,
 *   prices, ratings and flight numbers are synthetic but realistic, scaled by
 *   a per-destination price tier.
 *   That is normal for a portfolio project — but it IS synthetic seed data,
 *   not scraped live inventory. Say so plainly if anyone asks.
 *
 * REPLACES the older JSON-file seeder, which covered 20 destinations with
 * ~1,100 hand-maintained records. Generating from a destination list scales to
 * hundreds of cities without keeping megabytes of JSON in the repo.
 *
 * FLAGS
 *   node seed/seed.js --dry-run      generate and report, write nothing
 *   node seed/seed.js --only=india   seed only Indian destinations
 *   node seed/seed.js --keep         do not wipe existing inventory first
 * ============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const indiaDestinations = require('./data/india');
const worldDestinations = require('./data/world');
const gen = require('./generators');

/**
 * Mongoose and the models are loaded lazily, inside loadDb().
 *
 * That keeps `--dry-run` completely free of database dependencies: you can
 * generate and inspect the whole dataset without Mongo installed, running, or
 * configured. Requiring them at the top of the file would make a dry run wait
 * on a driver it never uses.
 */
const loadDb = () => ({
  mongoose: require('mongoose'),
  Hotel: require('../src/models/Hotel'),
  Restaurant: require('../src/models/Restaurant'),
  TouristPlace: require('../src/models/TouristPlace'),
  Flight: require('../src/models/Flight'),
  Destination: require('../src/models/Destination'),
});

// --- Config --------------------------------------------------------------

const PER_DESTINATION = { hotels: 14, restaurants: 16, attractions: 12 };

/** Flights are generated from these hub cities into every destination. */
const HUB_CITIES = [
  'Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad',
  'Dubai', 'Singapore', 'London', 'Bangkok',
];

const BATCH_SIZE = 500;

// --- CLI -----------------------------------------------------------------

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : null;
};

const DRY_RUN = hasFlag('--dry-run');
const KEEP = hasFlag('--keep');
const ONLY = getArg('only');

const fmt = (n) => n.toLocaleString('en-IN');

const insertInBatches = async (Model, docs, label) => {
  if (!docs.length) return 0;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    // ordered:false means one bad document doesn't abort the whole batch.
    await Model.insertMany(batch, { ordered: false });
    inserted += batch.length;
    process.stdout.write(`\r  ${label} ${fmt(inserted)} / ${fmt(docs.length)}`);
  }
  process.stdout.write(`\r  ${label} ${fmt(inserted)} inserted${' '.repeat(24)}\n`);
  return inserted;
};

// --- Main ----------------------------------------------------------------

const run = async () => {
  const startedAt = Date.now();

  console.log('\n==================================================');
  console.log('   VELORA - TRAVEL DATABASE SEEDER');
  console.log('==================================================\n');

  let destinations;
  if (ONLY === 'india') destinations = indiaDestinations;
  else if (ONLY === 'world') destinations = worldDestinations;
  else destinations = [...indiaDestinations, ...worldDestinations];

  // A duplicate city would silently double that city's inventory and break the
  // unique slug index on Destination. Fail loudly instead.
  const seen = new Set();
  const duplicates = [];
  for (const d of destinations) {
    const slug = gen.slugify(d.city);
    if (seen.has(slug)) duplicates.push(d.city);
    seen.add(slug);
  }
  if (duplicates.length) {
    console.error(`FAILED: duplicate destinations in the data files: ${duplicates.join(', ')}`);
    process.exit(1);
  }

  console.log(`Destinations:    ${destinations.length}`);
  console.log(`  India:         ${destinations.filter((d) => d.country === 'India').length}`);
  console.log(`  International: ${destinations.filter((d) => d.country !== 'India').length}`);
  console.log(`  Countries:     ${new Set(destinations.map((d) => d.country)).size}\n`);

  // Generate everything in memory FIRST, so a generator bug fails before we've
  // wiped the database.
  console.log('Generating records...');
  const hubs = destinations.filter((d) => HUB_CITIES.includes(d.city));

  const hotels = [];
  const restaurants = [];
  const attractions = [];
  const flights = [];
  const destinationDocs = [];

  for (const d of destinations) {
    hotels.push(...gen.generateHotels(d, PER_DESTINATION.hotels));
    restaurants.push(...gen.generateRestaurants(d, PER_DESTINATION.restaurants));
    attractions.push(...gen.generateAttractions(d, PER_DESTINATION.attractions));
    flights.push(...gen.generateFlights(d, hubs, 3));
    destinationDocs.push(gen.generateDestinationDoc(d));
  }

  const total = hotels.length + restaurants.length + attractions.length +
    flights.length + destinationDocs.length;

  console.log(`  Hotels        ${fmt(hotels.length)}`);
  console.log(`  Restaurants   ${fmt(restaurants.length)}`);
  console.log(`  Attractions   ${fmt(attractions.length)}`);
  console.log(`  Flights       ${fmt(flights.length)}`);
  console.log(`  Destinations  ${fmt(destinationDocs.length)}`);
  console.log(`  ----------------------`);
  console.log(`  TOTAL         ${fmt(total)} documents\n`);

  if (DRY_RUN) {
    console.log('--dry-run: nothing written (no database needed).\n');
    console.log('Sample hotel:');
    console.log(JSON.stringify(hotels[0], null, 2));
    console.log('\nSample restaurant:');
    console.log(JSON.stringify(restaurants[0], null, 2));
    console.log('\nSample flight:');
    console.log(JSON.stringify(flights[0], null, 2));
    return;
  }

  // Everything past this point needs the database.
  const { mongoose, Hotel, Restaurant, TouristPlace, Flight, Destination } = loadDb();

  // Must run BEFORE connect: mongodb+srv:// resolves an SRV record first, and
  // that lookup is what fails on machines whose only nameserver is an IPv6
  // link-local address Node cannot reach.
  require('../src/config/dns')();

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/Velora';
  console.log(`Connecting to ${uri.replace(/\/\/[^@]*@/, '//***@')} ...`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('  connected\n');

  /**
   * Landmark photos survive a reseed.
   *
   * `npm run fetch-images` looks up a real Wikipedia photo for every landmark
   * — 171 cities, a few minutes of API calls. Those URLs live on the
   * Destination documents this script is about to delete, so without this a
   * routine reseed silently throws all of it away and the galleries go blank
   * until someone remembers to re-run the fetch.
   *
   * Keyed on citySlug + landmark name, which is stable across reseeds because
   * both come from the curated source data.
   */
  const preservedImages = new Map();
  if (!KEEP) {
    const existing = await Destination.find().select('citySlug famousPlaces').lean();
    for (const dest of existing) {
      for (const place of dest.famousPlaces || []) {
        if (place.imageUrl) {
          preservedImages.set(`${dest.citySlug}::${place.name}`, {
            imageUrl: place.imageUrl,
            wikipediaUrl: place.wikipediaUrl,
            attribution: place.attribution,
          });
        }
      }
    }
    if (preservedImages.size) {
      console.log(`Preserving ${fmt(preservedImages.size)} landmark photos across the reseed\n`);
    }
  }

  // Inventory only. User accounts, trips and generated itineraries are left
  // alone so re-seeding never destroys real work.
  if (!KEEP) {
    console.log('Clearing existing inventory...');
    const cleared = await Promise.all([
      Hotel.deleteMany({}), Restaurant.deleteMany({}), TouristPlace.deleteMany({}),
      Flight.deleteMany({}), Destination.deleteMany({}),
    ]);
    console.log(`  removed ${fmt(cleared.reduce((s, r) => s + r.deletedCount, 0))} old documents\n`);
  }

  // Re-attach the photos to the freshly generated documents.
  if (preservedImages.size) {
    for (const dest of destinationDocs) {
      for (const place of dest.famousPlaces || []) {
        const saved = preservedImages.get(`${dest.citySlug}::${place.name}`);
        if (saved) Object.assign(place, saved);
      }
    }
  }

  console.log('Inserting...');
  await insertInBatches(Destination, destinationDocs, 'Destinations');
  await insertInBatches(Hotel, hotels, 'Hotels      ');
  await insertInBatches(Restaurant, restaurants, 'Restaurants ');
  await insertInBatches(TouristPlace, attractions, 'Attractions ');
  await insertInBatches(Flight, flights, 'Flights     ');

  // Mongoose builds indexes lazily by default. Doing it here means the first
  // real user query is already fast.
  console.log('\nBuilding indexes...');
  for (const [name, Model] of Object.entries({
    Destination, Hotel, Restaurant, TouristPlace, Flight,
  })) {
    await Model.syncIndexes();
    const idx = await Model.collection.indexes();
    console.log(`  ${name.padEnd(13)} ${idx.length} indexes`);
  }

  // Prove the citySlug work actually paid off: this query must use an index
  // scan (IXSCAN), not a collection scan (COLLSCAN).
  console.log('\nVerifying...');
  const goaHotels = await Hotel.countDocuments({ citySlug: 'goa' });
  const parisRestaurants = await Restaurant.countDocuments({ citySlug: 'paris' });
  const delhiToGoa = await Flight.countDocuments({ fromSlug: 'delhi', toSlug: 'goa' });

  const explain = await Hotel.find({ citySlug: 'goa' })
    .sort({ rating: -1 }).limit(5).explain('queryPlanner');
  const plan = explain?.queryPlanner?.winningPlan;
  const stage = plan?.inputStage?.stage || plan?.stage || 'unknown';
  const usesIndex = JSON.stringify(plan).includes('IXSCAN');

  console.log(`  Hotels in Goa:          ${goaHotels}`);
  console.log(`  Restaurants in Paris:   ${parisRestaurants}`);
  console.log(`  Flights Delhi->Goa:     ${delhiToGoa}`);
  console.log(`  Goa query plan:         ${stage} ${usesIndex ? '(index used)' : '(WARNING: collection scan)'}`);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone in ${seconds}s — ${fmt(total)} documents across 5 collections.\n`);
};

run()
  .catch((err) => {
    console.error('\nSeed failed:', err.message);
    if (err.writeErrors?.length) {
      console.error('First write error:', err.writeErrors[0].err?.errmsg);
    }
    // Seeding is usually the first thing pointed at a new Atlas cluster, so
    // it's where connection problems surface — and where the explanation is
    // most useful.
    require('../src/config/dbErrors').printConnectionHelp(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Only touch mongoose if it was actually loaded (a dry run never loads it).
    if (!DRY_RUN) {
      const { mongoose } = loadDb();
      if (mongoose.connection.readyState) await mongoose.disconnect();
    }
  });
