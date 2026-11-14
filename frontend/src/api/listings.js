// Pretend server calls. There is no backend yet (that is Task 3), so these
// read the local JSON files but behave like a network request: they take a
// moment to answer and they can fail. That lets the search page show real
// loading and error states now, and later we only swap these two functions.
import listings from '../data/listings.json';
import zips from '../data/zips.json';

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
