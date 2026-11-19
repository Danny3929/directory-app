import { describe, it, expect } from 'vitest';
import { gymImage, tagCounts, PHOTOS } from './gymImage.js';
import listings from '../data/listings.json';

// Same numbers as the real data: classes 15, weights and strength 10, the rest 5.
const counts = { classes: 15, weights: 10, strength: 10, boxing: 5, yoga: 5, pilates: 5, spin: 5, outdoor: 5 };

const gym = (id, tags) => ({ id, name: `Gym ${id}`, tags });
const file = (result) => result.src.split('/').pop();

describe('tagCounts', () => {
  it('counts how many gyms have each tag', () => {
    expect(tagCounts([gym(1, ['yoga', 'classes']), gym(2, ['yoga']), gym(3, [])])).toEqual({ yoga: 2, classes: 1 });
  });

  it('copes with gyms that have no tags list', () => {
    expect(tagCounts([{ id: 1 }])).toEqual({});
  });
});

describe('gymImage: the tag the visitor searched for wins', () => {
  it('shows boxing when the search mentions boxing, even though strength is more popular', () => {
    expect(file(gymImage(gym(1, ['boxing', 'strength']), { query: 'boxing', counts }))).toBe('boxing.webp');
  });

  it('ignores upper/lower case and other words in the search', () => {
    expect(file(gymImage(gym(1, ['boxing', 'strength']), { query: 'BOXING near Westlands', counts }))).toBe('boxing.webp');
  });

  it('falls back to popularity when the searched tag is not on this gym', () => {
    expect(file(gymImage(gym(1, ['boxing', 'strength']), { query: 'yoga', counts }))).toBe('strength.webp');
  });
});

describe('gymImage: otherwise the most popular tag wins', () => {
  it('picks the tag on the most gyms', () => {
    expect(file(gymImage(gym(1, ['outdoor', 'weights']), { counts }))).toBe('weights.webp');
  });

  it('breaks a tie A to Z', () => {
    expect(file(gymImage(gym(1, ['yoga', 'pilates']), { counts }))).toBe('pilates.webp');
    expect(file(gymImage(gym(1, ['weights', 'strength']), { counts }))).toBe('strength.webp');
  });

  it('skips tags that have no photo (beginner, cardio...)', () => {
    expect(file(gymImage(gym(1, ['beginner', 'boxing']), { counts: { beginner: 99, boxing: 5 } }))).toBe('boxing.webp');
  });
});

describe('gymImage: fallback and spin', () => {
  it('gives the classes photo when no tag has a photo', () => {
    const result = gymImage(gym(1, ['beginner', 'cardio']), { counts });
    expect(file(result)).toBe('classes.webp');
    expect(result.tag).toBe('classes');
  });

  it('gives the classes photo for a gym with no tags at all', () => {
    expect(file(gymImage({ id: 7 }))).toBe('classes.webp');
  });

  it('alternates the two spin photos by gym id', () => {
    expect(file(gymImage(gym(2, ['spin']), { counts }))).toBe('spin-1.webp');
    expect(file(gymImage(gym(3, ['spin']), { counts }))).toBe('spin-2.webp');
  });
});

describe('every photo', () => {
  it('has alt text and a file in public/images', async () => {
    const { existsSync } = await import('node:fs');
    for (const [tag, photos] of Object.entries(PHOTOS)) {
      for (const p of photos) {
        expect(p.alt.length, tag).toBeGreaterThan(10);
        expect(existsSync(new URL(`../../public/images/${p.file}`, import.meta.url)), p.file).toBe(true);
      }
    }
  });

  it('gives every real gym a photo', () => {
    const real = tagCounts(listings);
    for (const g of listings) expect(gymImage(g, { counts: real }).src).toMatch(/\.webp$/);
  });
});
