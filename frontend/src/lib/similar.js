// "Similar gyms" on the detail page. Plain function, no React.
// Dan's rule (2026-11-15):
//   1. More shared tags first. Gyms sharing no tag are left out.
//   2. Same number of shared tags: the nearer gym first.
//   3. Still tied: A to Z by name, ignoring case.
//   4. Never the gym itself, and at most 3.
import { distanceKm } from './geo.js';

export const SIMILAR_LIMIT = 3;

// How far other is from gym, or Infinity if either has no position
// (so gyms without a position go after the ones we can measure).
function distanceBetween(gym, other) {
  try {
    return distanceKm(gym.lat, gym.lng, other.lat, other.lng);
  } catch {
    return Infinity;
  }
}

export function similarGyms(gym, all, limit = SIMILAR_LIMIT) {
  const myTags = new Set(gym.tags ?? []);
  if (myTags.size === 0) return [];

  return all
    .filter((other) => other.id !== gym.id)
    .map((other) => ({
      other,
      shared: (other.tags ?? []).filter((tag) => myTags.has(tag)).length,
      km: distanceBetween(gym, other),
    }))
    .filter(({ shared }) => shared > 0)
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        // Infinity - Infinity is NaN, which is not a usable answer: treat it as a tie.
        (a.km - b.km || 0) ||
        a.other.name.localeCompare(b.other.name, undefined, { sensitivity: 'base' }),
    )
    .slice(0, limit)
    .map(({ other }) => other);
}
