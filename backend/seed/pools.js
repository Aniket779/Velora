'use strict';

/**
 * ============================================================================
 * BUILDING BLOCKS FOR GENERATED DATA
 * ============================================================================
 * Word pools the generators combine to build hotel names, restaurant names,
 * amenities and so on.
 *
 * The DESTINATIONS are real (real names, real coordinates, real airports, real
 * attractions). The individual businesses are generated from these pools using
 * naming patterns that match how hotels and restaurants are actually named in
 * each region — so an Indian hill station gets "Pine Valley Resort, Mall Road"
 * and Japan gets "Sakura Ryokan, Gion".
 * ============================================================================
 */

// --- Hotel naming --------------------------------------------------------

const HOTEL_PREFIX = {
  india: ['The', 'Hotel', 'Royal', 'Grand', 'Hotel Shri', 'The Regal', 'Hotel Sagar'],
  luxury: ['The', 'The Grand', 'The Royal', 'The Imperial'],
  europe: ['Hotel', 'Grand Hotel', 'Hôtel', 'Residenza', 'Casa', 'The'],
  asia: ['The', 'Hotel', 'Grand', 'Sakura', 'Lotus'],
  generic: ['The', 'Hotel', 'Grand'],
};

const HOTEL_SUFFIX = {
  beach: ['Beach Resort', 'Beach Retreat', 'Sands Resort', 'Cove Resort', 'Bay Hotel', 'Shore Villas'],
  hill: ['Hill Resort', 'Valley Retreat', 'Pine Lodge', 'Mountain Inn', 'Ridge Resort', 'Cottages'],
  desert: ['Desert Camp', 'Haveli', 'Fort Palace', 'Dunes Resort', 'Sand Retreat'],
  metro: ['Suites', 'Grand', 'Business Hotel', 'Residency', 'Towers', 'Central', 'Plaza'],
  pilgrimage: ['Dharamshala Residency', 'Pilgrim Inn', 'Ashram Stay', 'Guest House', 'Yatri Niwas'],
  wildlife: ['Jungle Lodge', 'Safari Camp', 'Forest Retreat', 'Wilderness Resort', 'Nature Camp'],
  heritage: ['Heritage Haveli', 'Palace Hotel', 'Heritage Villas', 'Fort View'],
  generic: ['Hotel', 'Resort', 'Inn', 'Lodge', 'Suites', 'Residency'],
};

const HOTEL_BRAND_STYLE = {
  budget: ['Backpackers', 'Hostel', 'Guest House', 'Lodge', 'Inn', 'Stay'],
  mid: ['Hotel', 'Residency', 'Suites', 'Comfort', 'Park'],
  luxury: ['Palace', 'Grand', 'Luxury Collection', 'Spa Resort', 'Boutique'],
};

const AMENITIES = {
  budget: ['Free WiFi', 'Hot Water', '24hr Front Desk', 'Luggage Storage', 'Daily Housekeeping'],
  mid: ['Free WiFi', 'Breakfast Included', 'Air Conditioning', 'Room Service', 'Parking', 'Laundry', 'Restaurant'],
  luxury: ['Free WiFi', 'Infinity Pool', 'Spa', 'Fine Dining', 'Concierge', 'Airport Transfer',
    'Fitness Centre', 'Butler Service', 'Rooftop Bar', 'Business Centre'],
};

// --- Restaurant naming ---------------------------------------------------

const RESTAURANT_PATTERN = {
  india: ['{area} {word}', '{word} {suffix}', 'The {word}', '{word} Dhaba', 'Hotel {word}', '{word} Bhavan'],
  europe: ['{word}', 'Trattoria {word}', 'Café {word}', 'Le {word}', 'Casa {word}', '{word} Bistro'],
  asia: ['{word}', '{word} Kitchen', '{word} House', '{word} Izakaya', '{word} Noodle Bar'],
  generic: ['{word}', 'The {word}', '{word} Kitchen', '{word} House', '{word} & Co'],
};

const RESTAURANT_WORDS = {
  india: ['Spice', 'Saffron', 'Tandoor', 'Masala', 'Chulha', 'Curry Leaf', 'Copper Pot', 'Mirchi',
    'Annapurna', 'Nalanda', 'Rasoi', 'Zaika', 'Kebab', 'Handi', 'Peshawari', 'Malabar', 'Chettinad'],
  europe: ['Verde', 'Bella', 'Marina', 'Sole', 'Rustica', 'Nonna', 'Olive', 'Terrazza', 'Alto',
    'Bianco', 'Fiore', 'Bodega', 'Taverna', 'Brasserie'],
  asia: ['Sakura', 'Bamboo', 'Golden Lotus', 'Red Lantern', 'Wok', 'Umami', 'Zen', 'Jade',
    'Basil', 'Lemongrass', 'Pho', 'Ramen', 'Dragon'],
  generic: ['Harvest', 'Ember', 'Copper', 'Fig', 'Larder', 'Table', 'Grain', 'Salt', 'Smoke'],
};

const RESTAURANT_SUFFIX = ['Restaurant', 'Kitchen', 'Eatery', 'Diner', 'Bistro', 'Grill', 'Café'];

/**
 * Cuisine TYPE by region — distinct from the destination's signature dishes.
 *
 * A restaurant serves "Goan" cuisine and its signature dish is "Bebinca".
 * Conflating the two produced records claiming a restaurant's cuisine was
 * "Bebinca", which is a dessert. The AI prompt shows cuisine for dietary
 * filtering, so this needed to be a real category.
 */
const CUISINE_BY_INDIAN_STATE = {
  'Goa': 'Goan', 'Kerala': 'Keralan', 'Rajasthan': 'Rajasthani', 'Punjab': 'Punjabi',
  'Tamil Nadu': 'South Indian', 'Karnataka': 'South Indian', 'Andhra Pradesh': 'Andhra',
  'Telangana': 'Hyderabadi', 'West Bengal': 'Bengali', 'Gujarat': 'Gujarati',
  'Maharashtra': 'Maharashtrian', 'Uttar Pradesh': 'Awadhi', 'Delhi': 'North Indian',
  'Himachal Pradesh': 'Himachali', 'Uttarakhand': 'Kumaoni', 'Jammu and Kashmir': 'Kashmiri',
  'Ladakh': 'Ladakhi', 'Sikkim': 'Sikkimese', 'Assam': 'Assamese', 'Meghalaya': 'Khasi',
  'Odisha': 'Odia', 'Bihar': 'Bihari', 'Madhya Pradesh': 'Malwa', 'Puducherry': 'French-Tamil',
  'Arunachal Pradesh': 'Northeastern', 'Chandigarh': 'Punjabi', 'Daman and Diu': 'Portuguese-Indian',
  'Andaman and Nicobar Islands': 'Coastal Indian',
};

const CUISINE_BY_COUNTRY = {
  'Japan': 'Japanese', 'China': 'Chinese', 'Thailand': 'Thai', 'Vietnam': 'Vietnamese',
  'Indonesia': 'Indonesian', 'Singapore': 'Singaporean', 'South Korea': 'Korean',
  'France': 'French', 'Italy': 'Italian', 'Spain': 'Spanish', 'Germany': 'German',
  'Netherlands': 'Dutch', 'Greece': 'Greek', 'Portugal': 'Portuguese',
  'Switzerland': 'Swiss', 'Austria': 'Austrian', 'Czech Republic': 'Czech',
  'Hungary': 'Hungarian', 'Croatia': 'Croatian', 'Denmark': 'Danish',
  'Sweden': 'Swedish', 'Norway': 'Norwegian', 'Iceland': 'Icelandic',
  'United Kingdom': 'British', 'Ireland': 'Irish', 'Belgium': 'Belgian',
  'United States': 'American', 'Australia': 'Modern Australian',
  'United Arab Emirates': 'Emirati', 'Brazil': 'Brazilian', 'Argentina': 'Argentine',
  'Peru': 'Peruvian', 'Chile': 'Chilean', 'Colombia': 'Colombian',
  'Nepal': 'Nepali', 'Sri Lanka': 'Sri Lankan', 'Maldives': 'Maldivian',
};

/** Secondary cuisines a traveller-facing restaurant plausibly also serves. */
const SECONDARY_CUISINES = [
  'Continental', 'Chinese', 'Italian', 'Cafe', 'Street Food',
  'Seafood', 'Vegetarian', 'Bakery', 'Multi-cuisine',
];

const OPENING_HOURS = [
  '07:00 AM - 11:00 PM', '11:00 AM - 11:00 PM', '12:00 PM - 03:00 PM, 07:00 PM - 11:00 PM',
  '08:00 AM - 10:00 PM', '06:00 PM - 12:00 AM', '10:00 AM - 10:30 PM',
];

// --- Attractions ---------------------------------------------------------

/**
 * Secondary attractions, used after a destination's curated real sights.
 *
 * `{city}` is substituted with the actual destination name, so these read as
 * plausible real places ("Anjuna Fish Market Walk", "Shimla Heritage Walk")
 * rather than obvious filler. They are the kind of activity that genuinely
 * exists in almost every destination of that type — a sunset point in a beach
 * town, a morning market in a hill station.
 *
 * They are still GENERATED, not researched. The curated `sights` list on each
 * destination is the factual part.
 */
const GENERIC_SIGHTS = {
  beach: [
    ['{city} Sunset Point', 'Nature'], ['{city} Fish Market Walk', 'Culture'],
    ['{city} Coastal Promenade', 'Nature'], ['{city} Water Sports Jetty', 'Adventure'],
    ['{city} Lighthouse Viewpoint', 'Nature'], ['{city} Beach Shack Trail', 'Culture'],
    ['{city} Sunrise Kayaking', 'Adventure'], ['{city} Seafront Craft Market', 'Shopping'],
  ],
  hill: [
    ['{city} Ridge Viewpoint', 'Nature'], ['{city} Morning Market', 'Shopping'],
    ['{city} Pine Forest Trail', 'Nature'], ['{city} Valley Sunset Point', 'Nature'],
    ['{city} Tea Garden Walk', 'Nature'], ['{city} Cable Car Ride', 'Adventure'],
    ['{city} Old Church', 'Historical'], ['{city} Handicraft Emporium', 'Shopping'],
  ],
  desert: [
    ['{city} Dune Sunset Point', 'Nature'], ['{city} Camel Safari Camp', 'Adventure'],
    ['{city} Old Bazaar', 'Shopping'], ['{city} Folk Music Evening', 'Culture'],
    ['{city} Stepwell', 'Historical'], ['{city} Havelis Walk', 'Historical'],
    ['{city} Desert Night Camp', 'Adventure'], ['{city} Textile Workshop', 'Culture'],
  ],
  metro: [
    ['{city} City Museum', 'Museum'], ['{city} Central Park', 'Nature'],
    ['{city} Old Quarter Walk', 'Culture'], ['{city} Night Food Street', 'Shopping'],
    ['{city} Art District', 'Culture'], ['{city} Riverfront Promenade', 'Nature'],
    ['{city} Botanical Garden', 'Nature'], ['{city} Central Market', 'Shopping'],
  ],
  pilgrimage: [
    ['{city} Riverfront Ghats', 'Spiritual'], ['{city} Evening Aarti', 'Spiritual'],
    ['{city} Temple Bazaar', 'Shopping'], ['{city} Ashram Meditation Session', 'Spiritual'],
    ['{city} Old Temple Trail', 'Spiritual'], ['{city} Prasad Kitchen Visit', 'Culture'],
    ['{city} Sunrise Prayer Walk', 'Spiritual'], ['{city} Pilgrim Rest House Quarter', 'Culture'],
  ],
  wildlife: [
    ['{city} Core Zone Safari', 'Wildlife'], ['{city} Nature Interpretation Centre', 'Museum'],
    ['{city} Watchtower Point', 'Wildlife'], ['{city} Birding Trail', 'Wildlife'],
    ['{city} Night Safari', 'Wildlife'], ['{city} Buffer Zone Walk', 'Nature'],
    ['{city} Forest Rest House', 'Culture'], ['{city} River Crossing Point', 'Nature'],
  ],
  unesco: [
    ['{city} Heritage Walk', 'Historical'], ['{city} Archaeological Museum', 'Museum'],
    ['{city} Monument Gardens', 'Nature'], ['{city} Sound and Light Show', 'Culture'],
    ['{city} Craft Village', 'Shopping'], ['{city} Old City Gate', 'Historical'],
    ['{city} Stone Carving Workshop', 'Culture'], ['{city} Sunrise Monument View', 'Nature'],
  ],
  heritage: [
    ['{city} Palace Museum', 'Museum'], ['{city} Heritage Walk', 'Historical'],
    ['{city} Royal Gardens', 'Nature'], ['{city} Old City Bazaar', 'Shopping'],
    ['{city} Fort Ramparts', 'Historical'], ['{city} Folk Performance Evening', 'Culture'],
    ['{city} Stepwell', 'Historical'], ['{city} Artisan Quarter', 'Shopping'],
  ],
  generic: [
    ['{city} City Centre Walk', 'Culture'], ['{city} Local Market', 'Shopping'],
    ['{city} Viewpoint', 'Nature'], ['{city} Museum', 'Museum'],
    ['{city} Riverside Path', 'Nature'], ['{city} Food Street', 'Shopping'],
    ['{city} Old Town Quarter', 'Historical'], ['{city} Public Gardens', 'Nature'],
  ],
};

const VISIT_TIME = ['Early Morning', 'Morning', 'Afternoon', 'Late Afternoon', 'Evening', 'Sunset'];
const DURATIONS = ['45 minutes', '1 - 2 hours', '2 - 3 hours', '3 - 4 hours', 'Half day', 'Full day'];

// --- Airlines ------------------------------------------------------------

const AIRLINES = {
  india: [
    { name: 'IndiGo', code: '6E' }, { name: 'Air India', code: 'AI' },
    { name: 'Vistara', code: 'UK' }, { name: 'SpiceJet', code: 'SG' },
    { name: 'Akasa Air', code: 'QP' },
  ],
  international: [
    { name: 'Emirates', code: 'EK' }, { name: 'Qatar Airways', code: 'QR' },
    { name: 'Singapore Airlines', code: 'SQ' }, { name: 'Lufthansa', code: 'LH' },
    { name: 'British Airways', code: 'BA' }, { name: 'Thai Airways', code: 'TG' },
    { name: 'Etihad Airways', code: 'EY' }, { name: 'Air India', code: 'AI' },
  ],
};

// --- Images --------------------------------------------------------------
//
// Real Unsplash photo IDs, grouped by category. Generic stock imagery rather
// than a photo of the specific property, which is normal for seed data.

const IMAGES = {
  hotel: [
    'photo-1566073771259-6a8506099945', 'photo-1571003123894-1f0594d2b5d9',
    'photo-1582719478250-c89cae4dc85b', 'photo-1618773928121-c32242e63f39',
    'photo-1590490360182-c33d57733427', 'photo-1611892440504-42a792e24d32',
  ],
  restaurant: [
    'photo-1517248135467-4c7edcad34c4', 'photo-1552566626-52f8b828add9',
    'photo-1414235077428-338989a2e8c0', 'photo-1466978913421-dad2ebd01d17',
    'photo-1555396273-367ea4eb4db5',
  ],
  beach: ['photo-1507525428034-b723cf961d3e', 'photo-1519046904884-53103b34b206', 'photo-1505228395891-9a51e7e86bf6'],
  hill: ['photo-1506905925346-21bda4d32df4', 'photo-1454391304352-2bf4678b1a7a', 'photo-1464822759023-fed622ff2c3b'],
  desert: ['photo-1509316785289-025f5b846b35', 'photo-1547234935-80c7145ec969', 'photo-1682686581295-7364f0d5b2b1'],
  metro: ['photo-1449824913935-59a10b8d2000', 'photo-1477959858617-67f85cf4f1df', 'photo-1480714378408-67cf0d13bc1b'],
  pilgrimage: ['photo-1524492412937-b28074a5d7da', 'photo-1590050752117-238cb0fb12b1', 'photo-1609920658906-8223bd289001'],
  wildlife: ['photo-1549366021-9f761d450615', 'photo-1564760055775-d63b17a55c44', 'photo-1516426122078-c23e76319801'],
  unesco: ['photo-1564507592333-c60657eea523', 'photo-1548013146-72479768bada', 'photo-1477587458883-47145ed94245'],
  generic: ['photo-1488646953014-85cb44e25828', 'photo-1469474968028-56623f02e42e'],
};

const unsplash = (id, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/**
 * Every photo a destination is allowed to use, drawn from ALL of its tags.
 *
 * The old code used `IMAGES[primaryTag][0]` — the first photo of the first
 * tag — so all 67 destinations tagged `metro` got byte-identical images. Six
 * metros in the recommendations panel meant six copies of the same photo.
 *
 * Unioning the tags widens the pool meaningfully because most destinations
 * carry more than one: Delhi is [metro, unesco], Goa is [beach, metro]. That
 * turns a 3-photo pool into 6-8 and, more importantly, means two cities with
 * the same primary tag rarely land on the same picture.
 *
 * `generic` is appended as a floor so an unrecognised tag still gets variety
 * rather than falling back to a single image.
 */
const imagesForTags = (tags = []) => {
  const pool = [];
  for (const tag of tags) {
    for (const id of IMAGES[tag] || []) {
      if (!pool.includes(id)) pool.push(id);
    }
  }
  for (const id of IMAGES.generic) {
    if (!pool.includes(id)) pool.push(id);
  }
  return pool;
};

module.exports = {
  HOTEL_PREFIX, HOTEL_SUFFIX, HOTEL_BRAND_STYLE, AMENITIES,
  RESTAURANT_PATTERN, RESTAURANT_WORDS, RESTAURANT_SUFFIX, OPENING_HOURS,
  CUISINE_BY_INDIAN_STATE, CUISINE_BY_COUNTRY, SECONDARY_CUISINES,
  GENERIC_SIGHTS, VISIT_TIME, DURATIONS,
  AIRLINES, IMAGES, unsplash, imagesForTags,
};
