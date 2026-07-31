'use strict';

/**
 * ============================================================================
 * SYNC MONGODB INDEXES
 * ============================================================================
 * Run with:  npm run sync-indexes
 *
 * WHY THIS EXISTS
 * Mongoose's autoIndex CREATES indexes that are missing, but it never DROPS or
 * MODIFIES ones that already exist. So when an index definition changes, the
 * old index stays in the database and keeps enforcing the old rules.
 *
 * That's exactly what bit us: `shareToken` was declared unique+sparse with a
 * `default: null`. Sparse only skips documents where the field is ABSENT, but
 * the default put `null` on every document — so the second unshared itinerary
 * collided with the first:
 *
 *   E11000 duplicate key error ... index: shareToken_1 dup key: { shareToken: null }
 *
 * Fixing the schema alone doesn't help, because `shareToken_1` is still sitting
 * in the database. `syncIndexes()` drops indexes that no longer match the
 * schema and builds the ones that do.
 *
 * Run this after ANY index change. It's safe to run repeatedly.
 * ============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MODELS = {
  Hotel: require('../src/models/Hotel'),
  Restaurant: require('../src/models/Restaurant'),
  TouristPlace: require('../src/models/TouristPlace'),
  Flight: require('../src/models/Flight'),
  Destination: require('../src/models/Destination'),
  DestinationIntelligence: require('../src/models/DestinationIntelligence'),
  Itinerary: require('../src/models/Itinerary'),
  Trip: require('../src/models/Trip'),
  User: require('../src/models/User'),
  Booking: require('../src/models/Booking'),
  UserActivity: require('../src/models/UserActivity'),
};

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/Velora';

  console.log('\n==================================================');
  console.log('   SYNCING MONGODB INDEXES');
  console.log('==================================================\n');
  console.log(`Connecting to ${uri.replace(/\/\/[^@]*@/, '//***@')} ...`);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('  connected\n');

  for (const [name, Model] of Object.entries(MODELS)) {
    try {
      // Returns the names of any indexes it had to drop.
      const dropped = await Model.syncIndexes();
      const current = await Model.collection.indexes();

      const droppedNote = dropped?.length
        ? `  (dropped stale: ${dropped.join(', ')})`
        : '';
      console.log(`  ${name.padEnd(24)} ${String(current.length).padStart(2)} indexes${droppedNote}`);
    } catch (err) {
      // A duplicate-key failure here means existing DATA violates a new unique
      // index — worth naming loudly rather than failing the whole run.
      console.error(`  ${name.padEnd(24)} FAILED: ${err.message}`);
      if (err.code === 11000) {
        console.error(`    -> existing documents violate a unique index. Inspect and clean them, then re-run.`);
      }
    }
  }

  console.log('\nDone. Restart the backend so it picks up the new indexes.\n');
};

run()
  .catch((err) => {
    console.error('\nIndex sync failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
