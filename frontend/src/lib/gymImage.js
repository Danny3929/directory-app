// Which photo a gym card shows. Plain functions, no React.
// Dan's rule (NOTES.md, 2026-11-15):
//   1. If the search mentions one of the gym's tags, show that tag's photo.
//   2. Otherwise show the photo of the gym's most popular tag (on the most gyms).
//   3. Ties go A to Z. Tags with no photo (beginner, cardio...) are skipped.
//   4. No photo tag at all: the classes photo.
// In Task 3 a gym's own uploaded photo will come first.

// Files live in public/images/ (credits in CREDITS.md). Spin has two photos.
export const PHOTOS = {
  boxing: [{ file: 'boxing.webp', alt: 'Two men sparring with boxing gloves and pads' }],
  classes: [{ file: 'classes.webp', alt: 'A group fitness class doing lunges on a wooden floor' }],
  outdoor: [{ file: 'outdoor.webp', alt: 'A man doing pull-ups on an outdoor bar' }],
  pilates: [{ file: 'pilates.webp', alt: 'Women exercising on pilates reformer machines' }],
  spin: [
    { file: 'spin-1.webp', alt: 'A coach and riders in an indoor cycling class' },
    { file: 'spin-2.webp', alt: 'A row of red spin bikes in a studio' },
  ],
  strength: [{ file: 'strength.webp', alt: 'A woman pulling down on a lat machine in a gym' }],
  weights: [{ file: 'weights.webp', alt: 'A man curling a dumbbell in a weights gym' }],
  yoga: [{ file: 'yoga.webp', alt: 'A woman sitting cross-legged on a yoga mat' }],
};

const FALLBACK = 'classes';

// One photo file from a gym's "photos" list, as { file, src, alt },
// or null when we have no such photo (so the gallery can skip it).
export function photoFor(file) {
  for (const photos of Object.values(PHOTOS)) {
    const photo = photos.find((p) => p.file === file);
    if (photo) return { file, src: `${import.meta.env.BASE_URL}images/${file}`, alt: photo.alt };
  }
  return null;
}

// { tag: number of gyms with that tag }
export function tagCounts(listings) {
  const counts = {};
  for (const gym of listings) {
    for (const tag of gym.tags ?? []) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  return counts;
}

// Most popular first, ties A to Z.
function byPopularity(counts) {
  return (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b);
}

// gym: { id, tags }; query: the search text; counts: from tagCounts().
// Returns { src, alt, tag }.
export function gymImage(gym, { query = '', counts = {} } = {}) {
  const withPhoto = (gym.tags ?? []).filter((tag) => PHOTOS[tag]);
  const words = String(query).toLowerCase();
  const searched = withPhoto.filter((tag) => words.includes(tag));

  const pool = searched.length > 0 ? searched : withPhoto;
  const tag = [...pool].sort(byPopularity(counts))[0] ?? FALLBACK;

  const photos = PHOTOS[tag];
  // Several photos for one tag: take turns by id, so neighbours differ.
  const photo = photos[Math.abs(Number(gym.id) || 0) % photos.length];
  return { src: `${import.meta.env.BASE_URL}images/${photo.file}`, alt: photo.alt, tag };
}
