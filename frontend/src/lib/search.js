// Plain search and sort functions for the gym list. No React in here.
// None of them change the list they are given: each returns a new array.
// Array.prototype.sort is stable, so in the price and featured sorts, ties keep their data order.

import { distanceKm } from './geo.js';

// Keep gyms whose name or description contains the text (any upper/lower case).
// An empty or spaces-only query keeps everything.
export function filterByText(listings, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (needle === '') return [...listings];
  return listings.filter((gym) =>
    `${gym.name ?? ''} ${gym.description ?? ''}`.toLowerCase().includes(needle),
  );
}

// Nearest first; equal distances go A to Z by name (Dan's rule).
// origin is { lat, lng } (from a ZIP); null means "ZIP not found",
// so we leave the order alone. Gyms with no coordinates go last.
export function sortByDistance(listings, origin) {
  if (!origin) return [...listings];
  const withDistance = listings.map((gym) => ({
    ...gym,
    distanceKm:
      typeof gym.lat === 'number' && typeof gym.lng === 'number'
        ? distanceKm(origin.lat, origin.lng, gym.lat, gym.lng)
        : Infinity,
  }));
  return withDistance.sort((a, b) => {
    if (a.distanceKm === b.distanceKm) {
      // Tie (also Infinity vs Infinity): A to Z, ignoring upper/lower case.
      return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'en', { sensitivity: 'base' });
    }
    return a.distanceKm < b.distanceKm ? -1 : 1;
  });
}

// Lowest starting price (priceMin) first.
export function sortByCheapest(listings) {
  return [...listings].sort((a, b) => a.priceMin - b.priceMin);
}

// Featured gyms first.
export function sortByFeatured(listings) {
  return [...listings].sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)));
}
