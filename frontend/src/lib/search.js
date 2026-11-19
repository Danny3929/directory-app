// Plain search and sort functions for the gym list. No React in here.
// None of them change the list they are given: each returns a new array.
// Array.prototype.sort is stable, so in the price and featured sorts, ties keep their data order.

import { distanceKm } from './geo.js';
import { topPrice } from './price.js';

// Keep gyms whose name or description contains the text (any upper/lower case).
// An empty or spaces-only query keeps everything.
export function filterByText(listings, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (needle === '') return [...listings];
  return listings.filter((gym) =>
    `${gym.name ?? ''} ${gym.description ?? ''}`.toLowerCase().includes(needle),
  );
}

// Keep gyms no further than radiusKm from origin (a gym exactly on the line stays).
// No origin (no ZIP or an unknown one) or no radius: keep everything (Dan's spec).
// Gyms with no coordinates cannot be measured, so a radius leaves them out.
export function filterByRadius(listings, origin, radiusKm) {
  if (!origin || !radiusKm) return [...listings];
  return listings.filter(
    (gym) =>
      typeof gym.lat === 'number' &&
      typeof gym.lng === 'number' &&
      distanceKm(origin.lat, origin.lng, gym.lat, gym.lng) <= radiusKm,
  );
}

// Keep gyms that have EVERY picked tag (Dan's rule), so each extra tag narrows the list.
// No tags picked: keep everything.
export function filterByTags(listings, tags) {
  if (!tags || tags.length === 0) return [...listings];
  return listings.filter((gym) => tags.every((tag) => (gym.tags ?? []).includes(tag)));
}

// Keep gyms with at least one plan between min and max (Dan's rule: the
// ranges overlap, and a plan exactly on a limit counts). null = no limit.
// Min more than Max makes no sense, so the filter is off (the page says why).
export function filterByPrice(listings, min, max) {
  if (min != null && max != null && min > max) return [...listings];
  return listings.filter(
    (gym) => (max == null || gym.priceMin <= max) && (min == null || topPrice(gym) >= min),
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
