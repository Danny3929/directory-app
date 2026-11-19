import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { gymImage, tagCounts, photoFor, PHOTOS } from './gymImage.js';
import listings from '../data/listings.json';

const gym = (id, tags, photoTag, photos) => ({ id, name: `Gym ${id}`, tags, photoTag, photos });
const file = (result) => result.src.split('/').pop();
const CARD_TAGS = ['boxing', 'cardio', 'classes', 'outdoor', 'personal-training', 'spin', 'weights', 'womens', 'yoga'];

describe('tagCounts', () => {
  it('counts how many gyms have each tag', () => {
    expect(tagCounts([gym(1, ['yoga', 'classes']), gym(2, ['yoga']), gym(3, [])])).toEqual({ yoga: 2, classes: 1 });
  });

  it('copes with gyms that have no tags list', () => {
    expect(tagCounts([{ id: 1 }])).toEqual({});
  });
});

describe('gymImage: a gym shows its own photo (the first in its photos list)', () => {
  it('shows the gym\'s own outdoor photo', () => {
    expect(file(gymImage(gym(1, ['outdoor', 'weights'], 'outdoor', ['outdoor-3.webp', 'weights.webp'])))).toBe('outdoor-3.webp');
  });

  it('is not changed by what the visitor searched for', () => {
    const g = gym(1, ['outdoor', 'weights'], 'outdoor', ['outdoor-3.webp']);
    expect(file(gymImage(g, { query: 'weights' }))).toBe('outdoor-3.webp');
  });

  it('gives the same photo every time for the same gym', () => {
    const g = gym(4, ['spin'], 'spin', ['spin-4.webp']);
    expect(file(gymImage(g))).toBe(file(gymImage({ ...g })));
  });

  it('returns the tag and some alt text', () => {
    const result = gymImage(gym(1, ['cardio'], 'cardio', ['cardio-2.webp']));
    expect(result.tag).toBe('cardio');
    expect(result.alt.length).toBeGreaterThan(10);
  });
});

describe('gymImage: fallback', () => {
  it('uses the first photo of the tag when the gym\'s own photo is from another tag', () => {
    expect(file(gymImage(gym(1, ['boxing'], 'boxing', ['yoga-2.webp'])))).toBe(PHOTOS.boxing[0].file);
  });

  it('uses the first photo of the tag when the gym has no photos list', () => {
    expect(file(gymImage(gym(1, ['boxing'], 'boxing')))).toBe(PHOTOS.boxing[0].file);
  });

  it('gives the classes photo when the photoTag has no photos', () => {
    const result = gymImage(gym(1, ['beginner'], 'beginner'));
    expect(file(result)).toBe('classes.webp');
    expect(result.tag).toBe('classes');
  });

  it('gives the classes photo for a gym with nothing at all', () => {
    expect(file(gymImage({ id: 7 }))).toBe('classes.webp');
  });
});

describe('PHOTOS', () => {
  it('has 5 photos for every tag a card can show', () => {
    for (const tag of CARD_TAGS) expect(PHOTOS[tag]?.length, tag).toBe(5);
  });

  it('never lists the same file twice', () => {
    const files = Object.values(PHOTOS).flat().map((p) => p.file);
    expect(new Set(files).size).toBe(files.length);
  });

  it('has alt text and a file in public/images for every photo', () => {
    for (const photo of Object.values(PHOTOS).flat()) {
      expect(photo.alt.length, photo.file).toBeGreaterThan(10);
      expect(existsSync(new URL(`../../public/images/${photo.file}`, import.meta.url)), photo.file).toBe(true);
    }
  });

  it('photoFor finds any listed photo and returns null for unknown files', () => {
    expect(photoFor('spin-4.webp').alt.length).toBeGreaterThan(10);
    expect(photoFor('nope.webp')).toBeNull();
  });
});

describe('the real gyms', () => {
  it('give every gym a photoTag that is one of its own tags', () => {
    for (const g of listings) expect(g.tags, `photoTag of ${g.name}`).toContain(g.photoTag);
  });

  it('show 45 different photos: no two gyms share a card photo', () => {
    const shown = listings.map((g) => file(gymImage(g)));
    expect(shown).toHaveLength(45);
    expect(new Set(shown).size).toBe(45);
  });

  it('show a photo that belongs to the gym\'s photoTag', () => {
    for (const g of listings) {
      const own = PHOTOS[g.photoTag].map((p) => p.file);
      expect(own, g.name).toContain(file(gymImage(g)));
      expect(g.photos[0], `${g.name} names its own photo first`).toBe(file(gymImage(g)));
    }
  });

  it('show an outdoor photo for every "open-air" gym', () => {
    const openAir = listings.filter((g) => g.description.includes('Open-air'));
    expect(openAir.length).toBeGreaterThan(0);
    for (const g of openAir) expect(gymImage(g).tag, g.name).toBe('outdoor');
  });
});
