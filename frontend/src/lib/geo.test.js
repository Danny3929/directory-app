import { describe, it, expect } from 'vitest';
import { distanceKm } from './geo.js';

describe('distanceKm', () => {
  it('is 0 for the same point', () => {
    expect(distanceKm(-1.29, 36.78, -1.29, 36.78)).toBe(0);
  });

  it('matches the known London to Paris distance (about 343.5 km)', () => {
    const d = distanceKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(d).toBeGreaterThan(342);
    expect(d).toBeLessThan(345);
  });

  it('gives the same answer in both directions', () => {
    const ab = distanceKm(-1.2864, 36.8172, -1.3192, 36.9278);
    const ba = distanceKm(-1.3192, 36.9278, -1.2864, 36.8172);
    expect(ab).toBeCloseTo(ba, 10);
  });

  it('measures Nairobi CBD to JKIA at roughly 12 to 13 km', () => {
    const d = distanceKm(-1.2864, 36.8172, -1.3192, 36.9278);
    expect(d).toBeGreaterThan(12);
    expect(d).toBeLessThan(13.5);
  });

  it('rejects missing coordinates instead of returning NaN', () => {
    expect(() => distanceKm(undefined, 36.78, -1.29, 36.78)).toThrow(TypeError);
  });
});
