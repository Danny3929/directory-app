import { describe, it, expect } from 'vitest';
import { gymImage, tagCounts, PHOTOS } from './gymImage.js';
import listings from '../data/listings.json';

const gym = (id, tags, photoTag) => ({ id, name: `Gym ${id}`, tags, photoTag });
const file = (result) => result.src.split('/').pop();

describe('tagCounts', () => {
  it('counts how many gyms have each tag', () => {
    expect(tagCounts([gym(1, ['yoga', 'classes']), gym(2, ['yoga']), gym(3, [])])).toEqual({ yoga: 2, classes: 1 });
  });

  it('copes with gyms that have no tags list', () => {
    expect(tagCounts([{ id: 1 }])).toEqual({});
  });
});

describe('gymImage: the gym shows the photo of its photoTag', () => {
  it('shows the outdoor photo for an outdoor gym, even though weights is more popular', () => {
    expect(file(gymImage(gym(1, ['outdoor', 'weights'], 'outdoor')))).toBe('outdoor.webp');
  });

  it('shows the boxing photo for a boxing gym that also has strength', () => {
    expect(file(gymImage(gym(1, ['boxing', 'strength'], 'boxing')))).toBe('boxing.webp');
  });

  it('is not changed by what the visitor searched for', () => {
    const g = gym(1, ['outdoor', 'weights'], 'outdoor');
    expect(file(gymImage(g, { query: 'weights' }))).toBe('outdoor.webp');
  });

  it('returns the tag and some alt text', () => {
    const result = gymImage(gym(1, ['cardio', 'stretching'], 'cardio'));
    expect(result.tag).toBe('cardio');
    expect(result.alt.length).toBeGreaterThan(10);
  });

  it('uses the same one photo for every gym with that photoTag, spin included', () => {
    expect(file(gymImage(gym(2, ['spin'], 'spin')))).toBe(file(gymImage(gym(3, ['spin'], 'spin'))));
  });
});

describe('gymImage: fallback', () => {
  it('gives the classes photo when the gym has no photoTag', () => {
    expect(file(gymImage(gym(1, ['beginner'])))).toBe('classes.webp');
  });

  it('gives the classes photo when the photoTag has no photo', () => {
    const result = gymImage(gym(1, ['beginner'], 'beginner'));
    expect(file(result)).toBe('classes.webp');
    expect(result.tag).toBe('classes');
  });

  it('gives the classes photo for a gym with no tags at all', () => {
    expect(file(gymImage({ id: 7 }))).toBe('classes.webp');
  });
});

describe('every tag has exactly one photo', () => {
  it('has alt text and a file in public/images', async () => {
    const { existsSync } = await import('node:fs');
    for (const [tag, photo] of Object.entries(PHOTOS)) {
      expect(photo.alt.length, tag).toBeGreaterThan(10);
      expect(existsSync(new URL(`../../public/images/${photo.file}`, import.meta.url)), photo.file).toBe(true);
    }
  });
});

describe('the real gyms', () => {
  it('give every gym a photoTag that is one of its own tags and has a photo', () => {
    for (const g of listings) {
      expect(g.tags, `photoTag of ${g.name}`).toContain(g.photoTag);
      expect(PHOTOS[g.photoTag], `photo for ${g.photoTag}`).toBeDefined();
      expect(gymImage(g).tag, g.name).toBe(g.photoTag);
    }
  });

  it('show the outdoor photo for every "open-air" gym', () => {
    const openAir = listings.filter((g) => g.description.includes('Open-air'));
    expect(openAir.length).toBeGreaterThan(0);
    for (const g of openAir) expect(file(gymImage(g)), g.name).toBe('outdoor.webp');
  });
});
