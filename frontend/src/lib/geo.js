// Distance between two points on Earth, in kilometres (haversine formula).
// Plain English: the Earth is a ball, so we measure the shortest arc over its
// surface instead of a straight line on a flat map.
// Accuracy limit: it treats Earth as a perfect sphere (radius 6371 km), so it can
// be off by up to about 0.5%. It also ignores roads, so "5 km" is as the crow flies.

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function distanceKm(lat1, lng1, lat2, lng2) {
  const values = [lat1, lng1, lat2, lng2];
  if (values.some((v) => typeof v !== 'number' || Number.isNaN(v))) {
    throw new TypeError('distanceKm needs four numbers: lat1, lng1, lat2, lng2');
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  // "a" is the squared half-chord length between the two points.
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  // Turn the chord into an arc angle, then angle x radius = distance.
  const angle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * angle;
}
