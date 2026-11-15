// Pretend server calls. There is no backend yet (that is Task 3), so these
// read the local JSON files but behave like a network request: they take a
// moment to answer and they can fail. That lets the search page show real
// loading and error states now, and later we only swap these functions.
import listings from '../data/listings.json';
import zips from '../data/zips.json';
import { tagCounts } from '../lib/gymImage.js';
import { similarGyms } from '../lib/similar.js';

const DEFAULT_DELAY_MS = 500;

// Waits delayMs, then either gives back a fresh copy of data or fails.
function fakeRequest(data, { delayMs = DEFAULT_DELAY_MS, fail = false, errorMessage }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (fail) {
        reject(new Error(errorMessage));
      } else {
        // structuredClone makes a deep copy, so a page that edits the result
        // cannot change our "database" by accident.
        resolve(structuredClone(data));
      }
    }, delayMs);
  });
}

export function fetchListings(options = {}) {
  return fakeRequest(listings, {
    ...options,
    errorMessage: 'Could not load gyms. Please try again.',
  });
}

export function fetchZips(options = {}) {
  return fakeRequest(zips, {
    ...options,
    errorMessage: 'Could not load ZIP codes. Please try again.',
  });
}

// How many gyms have each tag, e.g. { classes: 15, yoga: 5 }. The detail page
// needs it to pick the same photo as the card. In Task 3 Django counts these.
export function fetchTagCounts(options = {}) {
  return fakeRequest(tagCounts(listings), {
    ...options,
    errorMessage: 'Could not load tag counts.',
  });
}

// One gym by its slug (the name part of /listing/baobab-barbell), or null when
// there is no such gym (the page shows "not found").
export function fetchListing(slug, options = {}) {
  const gym = listings.find((g) => g.slug === slug) ?? null;
  return fakeRequest(gym, {
    ...options,
    errorMessage: 'Could not load this gym. Please try again.',
  });
}

// Up to 3 gyms like this one (Dan's rule in lib/similar.js), or [] for an
// unknown slug. In Task 3 Django picks them, so the browser gets only 3 gyms.
export function fetchSimilarListings(slug, options = {}) {
  const gym = listings.find((g) => g.slug === slug);
  return fakeRequest(gym ? similarGyms(gym, listings) : [], {
    ...options,
    errorMessage: 'Could not load similar gyms.',
  });
}