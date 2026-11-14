// Plain search and sort functions for the gym list. No React in here.
// None of them change the list they are given: each returns a new array.
// Array.prototype.sort is stable, so gyms that tie keep their original data order.

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

// Nearest first. origin is { lat, lng } (from a ZIP); null means "ZIP not found",
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
    if (a.distanceKm === b.distanceKm) return 0; // also true for Infinity vs Infinity
    return a.distanceKm < b.distanceKm ? -1 : 1;
  });
}

// Lowest monthly price first.
export function sortByCheapest(listings) {
  return [...listings].sort((a, b) => a.priceKsh - b.priceKsh);
}

// Featured gyms first.
export function sortByFeatured(listings) {
  return [...listings].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}
