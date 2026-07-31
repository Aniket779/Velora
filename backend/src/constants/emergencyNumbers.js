'use strict';

/**
 * Verified emergency numbers, curated rather than generated.
 *
 * This is the one field in the destination intelligence set where a model
 * hallucination could cause real harm: a traveller in an emergency dialling a
 * number an LLM invented is a materially worse outcome than showing nothing.
 *
 * Any country present here OVERRIDES whatever the model produced. Countries not
 * listed fall back to model output, which is explicitly flagged `verified: false`
 * so the UI can label it as unconfirmed and tell the user to check locally.
 *
 * Maintenance note: these change rarely but they do change. Re-check on review.
 */

const VERIFIED_EMERGENCY_NUMBERS = Object.freeze({
  india: [
    { service: 'All-in-one emergency', number: '112' },
    { service: 'Police', number: '100' },
    { service: 'Fire', number: '101' },
    { service: 'Ambulance', number: '102' },
    { service: 'Disaster management', number: '108' },
    { service: 'Women helpline', number: '1091' },
    { service: 'Tourist helpline (national, multilingual)', number: '1363' },
  ],
  'united states': [
    { service: 'All emergencies', number: '911' },
  ],
  usa: [{ service: 'All emergencies', number: '911' }],
  'united kingdom': [
    { service: 'All emergencies', number: '999' },
    { service: 'Non-emergency police', number: '101' },
    { service: 'Non-emergency medical', number: '111' },
  ],
  uk: [
    { service: 'All emergencies', number: '999' },
    { service: 'EU-wide alternative', number: '112' },
  ],
  france: [
    { service: 'All emergencies (EU)', number: '112' },
    { service: 'Police', number: '17' },
    { service: 'Ambulance (SAMU)', number: '15' },
    { service: 'Fire', number: '18' },
  ],
  italy: [
    { service: 'All emergencies (EU)', number: '112' },
  ],
  spain: [{ service: 'All emergencies (EU)', number: '112' }],
  netherlands: [{ service: 'All emergencies (EU)', number: '112' }],
  japan: [
    { service: 'Police', number: '110' },
    { service: 'Fire and ambulance', number: '119' },
  ],
  'south korea': [
    { service: 'Police', number: '112' },
    { service: 'Fire and ambulance', number: '119' },
  ],
  singapore: [
    { service: 'Police', number: '999' },
    { service: 'Fire and ambulance', number: '995' },
  ],
  thailand: [
    { service: 'Emergency', number: '191' },
    { service: 'Tourist police', number: '1155' },
  ],
  uae: [
    { service: 'Police', number: '999' },
    { service: 'Ambulance', number: '998' },
    { service: 'Fire', number: '997' },
  ],
  indonesia: [
    { service: 'Police', number: '110' },
    { service: 'Ambulance', number: '118' },
  ],
  australia: [{ service: 'All emergencies', number: '000' }],
  turkey: [{ service: 'All emergencies', number: '112' }],
});

/**
 * Returns curated numbers for a country, or null when we have none.
 * Matching is loose because country names arrive from user input and model output.
 */
const getVerifiedEmergencyNumbers = (country) => {
  if (typeof country !== 'string') return null;
  const key = country.trim().toLowerCase();
  if (!key) return null;

  if (VERIFIED_EMERGENCY_NUMBERS[key]) return VERIFIED_EMERGENCY_NUMBERS[key];

  const match = Object.keys(VERIFIED_EMERGENCY_NUMBERS).find(
    (k) => key.includes(k) || k.includes(key)
  );
  return match ? VERIFIED_EMERGENCY_NUMBERS[match] : null;
};

module.exports = { VERIFIED_EMERGENCY_NUMBERS, getVerifiedEmergencyNumbers };
