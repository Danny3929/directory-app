import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import listings from './listings.json';
import zips from './zips.json';
import { distanceKm } from '../lib/geo.js';

// Rough centre of each area (checked against a map). A gym must sit within 1.5 km of its own area's centre.
const AREAS = {
  Kilimani: { lat: -1.2897, lng: 36.787 },
  Kileleshwa: { lat: -1.276, lng: 36.779 },
  Lavington: { lat: -1.28, lng: 36.769 },
  Westlands: { lat: -1.268, lng: 36.811 },
  'Upper Hill': { lat: -1.298, lng: 36.816 },
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
      expect(g.city).toBe('Nairobi');
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

  it('covers all five areas and has some featured gyms, but not most', () => {
    expect(new Set(listings.map((g) => g.area)).size).toBe(5);
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

  it('has unique ZIP codes, all inside Nairobi', () => {
    expect(new Set(zips.map((z) => z.zip)).size).toBe(zips.length);
    for (const z of zips) {
      expect(z.lat).toBeGreaterThan(-1.45);
      expect(z.lat).toBeLessThan(-1.15);
      expect(z.lng).toBeGreaterThan(36.65);
      expect(z.lng).toBeLessThan(36.95);
    }
  });
});
