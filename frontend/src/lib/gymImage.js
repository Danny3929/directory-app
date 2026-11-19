// Which photo a gym card shows. Plain functions, no React.
// Dan's rule (2026-11-19): every tag has ONE photo, and every gym has a
// "photoTag" (one of its own tags, chosen from its description).
//   1. The gym shows the photo of its photoTag. A search never changes it.
//   2. No photoTag, or a tag with no photo: the classes photo.
// In Task 3 a gym's own uploaded photo will come first.

// Files live in public/images/ (credits in CREDITS.md).
export const PHOTOS = {
  boxing: { file: 'boxing.webp', alt: 'Two men sparring with boxing gloves and pads' },
  cardio: { file: 'cardio.webp', alt: 'Treadmills in a bright gym with large windows' },
  classes: { file: 'classes.webp', alt: 'A group fitness class doing lunges on a wooden floor' },
  outdoor: { file: 'outdoor.webp', alt: 'A man doing pull-ups on an outdoor bar' },
  'personal-training': { file: 'personal-training.webp', alt: 'A personal trainer helping a woman on a leg press machine' },
  pilates: { file: 'pilates.webp', alt: 'Women exercising on pilates reformer machines' },
  spin: { file: 'spin-1.webp', alt: 'A coach and riders in an indoor cycling class' },
  strength: { file: 'strength.webp', alt: 'A woman pulling down on a lat machine in a gym' },
  weights: { file: 'weights.webp', alt: 'A man curling a dumbbell in a weights gym' },
  womens: { file: 'womens.webp', alt: 'Two women standing with arms crossed in a dark gym' },
  yoga: { file: 'yoga.webp', alt: 'A woman sitting cross-legged on a yoga mat' },
};

const FALLBACK = 'classes';

// One photo file from a gym's "photos" list, as { file, src, alt },
// or null when we have no such photo (so the gallery can skip it).
export function photoFor(file) {
  for (const photo of Object.values(PHOTOS)) {
    if (photo.file === file) return { file, src: `${import.meta.env.BASE_URL}images/${file}`, alt: photo.alt };
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

// gym: { photoTag }. Returns { src, alt, tag }.
export function gymImage(gym) {
  const tag = PHOTOS[gym?.photoTag] ? gym.photoTag : FALLBACK;
  const photo = PHOTOS[tag];
  return { src: `${import.meta.env.BASE_URL}images/${photo.file}`, alt: photo.alt, tag };
}
