// Which photo a gym card shows. Plain functions, no React.
// Dan's rule (2026-11-19): every gym has its OWN photo, so no two cards repeat.
//   1. Every gym has a "photoTag" (one of its own tags) and a "photos" list.
//      The first file in "photos" is the gym's own card photo, and it must be
//      one of the 5 photos of its photoTag. A search never changes it.
//   2. If that file is missing or from another tag: the first photo of the tag.
//   3. No photoTag, or a tag with no photos: the first classes photo.
// In Task 3 a gym's own uploaded photo will come first.

// Files live in public/images/ (credits in CREDITS.md). 5 photos per card tag;
// pilates and strength only appear in detail page galleries.
export const PHOTOS = {
  boxing: [
    { file: 'boxing.webp', alt: 'Two men sparring with boxing gloves and pads' },
    { file: 'boxing-2.webp', alt: 'A woman throwing a punch in a boxing gym with posters on the wall' },
    { file: 'boxing-3.webp', alt: 'Two men hitting heavy bags under a metal roof' },
    { file: 'boxing-4.webp', alt: 'Two boxers sparring in a ring, in black and white' },
    { file: 'boxing-5.webp', alt: 'An empty boxing ring with gloves hanging from the ceiling' },
  ],
  cardio: [
    { file: 'cardio.webp', alt: 'Treadmills in a bright gym with large windows' },
    { file: 'cardio-2.webp', alt: 'A row of treadmills in a dark gym with a wooden floor' },
    { file: 'cardio-3.webp', alt: 'A woman on a treadmill next to tall windows' },
    { file: 'cardio-4.webp', alt: 'Treadmills along a wall in a gym with a wooden floor' },
    { file: 'cardio-5.webp', alt: 'A woman on a treadmill above an indoor swimming pool' },
  ],
  classes: [
    { file: 'classes.webp', alt: 'A group fitness class doing lunges on a wooden floor' },
    { file: 'classes-2.webp', alt: 'A group class stretching resistance bands over their heads' },
    { file: 'classes-3.webp', alt: 'A row of women lifting small dumbbells in a class' },
    { file: 'classes-4.webp', alt: 'A group doing lunges with medicine balls in a bright gym' },
    { file: 'classes-5.webp', alt: 'A dance fitness class moving together in a studio' },
  ],
  outdoor: [
    { file: 'outdoor.webp', alt: 'A man doing pull-ups on an outdoor bar' },
    { file: 'outdoor-2.webp', alt: 'A group running together on an outdoor path' },
    { file: 'outdoor-3.webp', alt: 'Women doing step-ups and stretches at an outdoor sports ground' },
    { file: 'outdoor-4.webp', alt: 'People training with ropes and mats in an outdoor workout park' },
    { file: 'outdoor-5.webp', alt: 'People using red bars in an outdoor fitness park' },
  ],
  'personal-training': [
    { file: 'personal-training.webp', alt: 'A personal trainer helping a woman on a leg press machine' },
    { file: 'personal-training-2.webp', alt: 'A trainer kneeling beside a woman lifting a kettlebell' },
    { file: 'personal-training-3.webp', alt: 'A trainer watching a woman lift a barbell' },
    { file: 'personal-training-4.webp', alt: 'A trainer guiding a smiling woman pushing a weighted sled' },
    { file: 'personal-training-5.webp', alt: 'A trainer showing a client her progress on a tablet' },
  ],
  pilates: [{ file: 'pilates.webp', alt: 'Women exercising on pilates reformer machines' }],
  spin: [
    { file: 'spin-1.webp', alt: 'A coach and riders in an indoor cycling class' },
    { file: 'spin-2.webp', alt: 'A row of red exercise bikes in a gym' },
    { file: 'spin-3.webp', alt: 'Women riding exercise bikes in a spin class' },
    { file: 'spin-4.webp', alt: 'A row of air bikes with red frames in a gym' },
    { file: 'spin-5.webp', alt: 'Riders on bikes in an evening spin class' },
  ],
  strength: [{ file: 'strength.webp', alt: 'A woman pulling down on a lat machine in a gym' }],
  weights: [
    { file: 'weights.webp', alt: 'A man curling a dumbbell in a weights gym' },
    { file: 'weights-2.webp', alt: 'A woman training between long racks of dumbbells' },
    { file: 'weights-3.webp', alt: 'A man curling a dumbbell in a dark gym' },
    { file: 'weights-4.webp', alt: 'Rows of dumbbells on a rack, in black and white' },
    { file: 'weights-5.webp', alt: 'Hands lifting a dumbbell from a rack' },
  ],
  womens: [
    { file: 'womens.webp', alt: 'Two women standing with arms crossed in a dark gym' },
    { file: 'womens-2.webp', alt: 'A woman doing a one-arm dumbbell row on a bench' },
    { file: 'womens-3.webp', alt: 'A woman pulling down on a lat machine' },
    { file: 'womens-4.webp', alt: 'A woman lifting a barbell in a bright weights room' },
    { file: 'womens-5.webp', alt: 'A woman doing lunges with dumbbells' },
  ],
  yoga: [
    { file: 'yoga.webp', alt: 'A woman sitting cross-legged on a yoga mat' },
    { file: 'yoga-2.webp', alt: 'A woman in a downward dog pose, in black and white' },
    { file: 'yoga-3.webp', alt: 'A yoga class holding a lunge pose in a studio' },
    { file: 'yoga-4.webp', alt: 'A woman in a seated yoga stretch in a sunny room' },
    { file: 'yoga-5.webp', alt: 'A group doing a forward bend on yoga mats' },
  ],
};

const FALLBACK = 'classes';
const src = (file) => `${import.meta.env.BASE_URL}images/${file}`;

// One photo file from a gym's "photos" list, as { file, src, alt },
// or null when we have no such photo (so the gallery can skip it).
export function photoFor(file) {
  const photo = Object.values(PHOTOS).flat().find((p) => p.file === file);
  return photo ? { file, src: src(file), alt: photo.alt } : null;
}

// { tag: number of gyms with that tag }
export function tagCounts(listings) {
  const counts = {};
  for (const gym of listings) {
    for (const tag of gym.tags ?? []) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  return counts;
}

// gym: { photoTag, photos }. Returns { src, alt, tag }.
export function gymImage(gym) {
  const tag = PHOTOS[gym?.photoTag] ? gym.photoTag : FALLBACK;
  const list = PHOTOS[tag];
  const photo = list.find((p) => p.file === gym?.photos?.[0]) ?? list[0];
  return { src: src(photo.file), alt: photo.alt, tag };
}
