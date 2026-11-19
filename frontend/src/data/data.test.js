import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import listings from './listings.json';
import zips from './zips.json';
import { distanceKm } from '../lib/geo.js';

// Rough centre of each area and the county it is in. A gym must sit within 1.5 km of its own area's centre.
const AREAS = {
  Kilimani: { lat: -1.2897, lng: 36.787, county: 'Nairobi' },
  Kileleshwa: { lat: -1.276, lng: 36.779, county: 'Nairobi' },
  Lavington: { lat: -1.28, lng: 36.769, county: 'Nairobi' },
  Westlands: { lat: -1.268, lng: 36.811, county: 'Nairobi' },
  'Upper Hill': { lat: -1.298, lng: 36.816, county: 'Nairobi' },
  Karen: { lat: -1.319, lng: 36.711, county: 'Nairobi' },
  Ruaka: { lat: -1.2095, lng: 36.779, county: 'Kiambu' },
  Rongai: { lat: -1.396, lng: 36.745, county: 'Kajiado' },
  Kitengela: { lat: -1.473, lng: 36.96, county: 'Kajiado' },
  Thika: { lat: -1.0333, lng: 37.0693, county: 'Kiambu' },
};

describe('listings.json', () => {
  it('has at least 40 gyms', () => {
    expect(listings.length).toBeGreaterThanOrEqual(40);
  });

  it('gives every gym all its fields with the right types', () => {
    for (const g of listings) {
      expect(Number.isInteger(g.id), `id of ${g.name}`).toBe(true);
      expect(typeof g.name === 'string' && g.name.trim() !== '', `name of ${g.id}`).toBe(true);
      expect(typeof g.description === 'string' && g.description.trim() !== '', `description of ${g.id}`).toBe(true);
      expect(Array.isArray(g.tags) && g.tags.length > 0, `tags of ${g.id}`).toBe(true);
      expect(typeof g.address === 'string' && g.address !== '', `address of ${g.id}`).toBe(true);
      expect(Object.keys(AREAS), `area of ${g.id}`).toContain(g.area);
      expect(g.city, `city of ${g.name}`).toBe(AREAS[g.area].county);
      expect(Number.isInteger(g.priceMin) && g.priceMin > 0, `priceMin of ${g.id}`).toBe(true);
      expect(Number.isInteger(g.priceMax) && g.priceMax >= g.priceMin, `priceMax of ${g.id}`).toBe(true);
      expect(typeof g.isFeatured, `isFeatured of ${g.id}`).toBe('boolean');
      expect(g.slug, `slug of ${g.id}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(Array.isArray(g.photos) && g.photos.length > 0, `photos of ${g.id}`).toBe(true);
    }
  });

  it('has unique ids, names and slugs', () => {
    expect(new Set(listings.map((g) => g.id)).size).toBe(listings.length);
    expect(new Set(listings.map((g) => g.name)).size).toBe(listings.length);
    expect(new Set(listings.map((g) => g.slug)).size).toBe(listings.length);
  });

  it('gives every gym a ZIP from zips.json that matches its area', () => {
    const codes = new Map(zips.map((z) => [z.zip, z.label]));
    for (const g of listings) {
      expect(codes.get(g.zip), `zip of ${g.name}`).toBe(g.area);
    }
  });

  it('only lists photo files that exist in public/images/', () => {
    for (const g of listings) {
      for (const file of g.photos) {
        expect(existsSync(new URL(`../../public/images/${file}`, import.meta.url)), `${file} of ${g.name}`).toBe(true);
      }
    }
  });

  it('puts every gym inside its own area', () => {
    for (const g of listings) {
      const c = AREAS[g.area];
      expect(distanceKm(c.lat, c.lng, g.lat, g.lng), `${g.name} is far from ${g.area}`).toBeLessThan(1.5);
    }
  });

  it('makes every radius choice change the list from Kilimani (5 < 10 < 25 < 50 km)', () => {
    const k = AREAS.Kilimani;
    const within = (km) => listings.filter((g) => distanceKm(k.lat, k.lng, g.lat, g.lng) <= km).length;
    const counts = [5, 10, 25, 50].map(within);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i], `${[5, 10, 25, 50][i]} km should show more gyms than the step before`).toBeGreaterThan(counts[i - 1]);
    }
    expect(within(50)).toBe(listings.length);
  });

  it('covers all ten areas and has some featured gyms, but not most', () => {
    expect(new Set(listings.map((g) => g.area)).size).toBe(10);
    const featured = listings.filter((g) => g.isFeatured).length;
    expect(featured).toBeGreaterThanOrEqual(3);
    expect(featured).toBeLessThan(listings.length / 2);
  });
});

describe('zips.json', () => {
  it('has at least 10 ZIPs, each with a code, a label and numbers for lat/lng', () => {
    expect(zips.length).toBeGreaterThanOrEqual(10);
    for (const z of zips) {
      expect(z.zip).toMatch(/^\d{5}$/);
      expect(typeof z.label === 'string' && z.label !== '').toBe(true);
      expect(typeof z.lat).toBe('number');
      expect(typeof z.lng).toBe('number');
    }
  });

  it('has unique ZIP codes, all in the greater Nairobi area (Thika to Kitengela)', () => {
    expect(new Set(zips.map((z) => z.zip)).size).toBe(zips.length);
    for (const z of zips) {
      expect(z.lat, z.label).toBeGreaterThan(-1.5);
      expect(z.lat, z.label).toBeLessThan(-1.0);
      expect(z.lng, z.label).toBeGreaterThan(36.65);
      expect(z.lng, z.label).toBeLessThan(37.1);
    }
  });
});
