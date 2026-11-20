import { describe, expect, it } from 'vitest';
import { EMPTY_GYM, fromGym, gymErrors, toPayload } from './gymForm.js';

const good = {
  name: 'Baobab Barbell', description: 'Big gym', address: '1 Ngong Rd', area: '', city: 'Nairobi',
  zip_code: '00100', latitude: '-1.29', longitude: '36.8', price_min: '3000', price_max: '8000', tags: [],
};

describe('gymErrors', () => {
  it('accepts a good gym (area may be empty)', () => {
    expect(gymErrors(good)).toEqual({});
  });
  it('asks for every required box on an empty form', () => {
    const e = gymErrors(EMPTY_GYM);
    expect(Object.keys(e).sort()).toEqual(
      ['address', 'city', 'description', 'latitude', 'longitude', 'name', 'price_max', 'price_min', 'zip_code'].sort(),
    );
  });
  it('treats blank as missing, not as 0', () => {
    expect(gymErrors({ ...good, price_min: '' }).price_min).toBeTruthy();
    expect(gymErrors({ ...good, latitude: '  ' }).latitude).toBeTruthy();
  });
  it('rejects prices with cents, negatives and minimum above maximum', () => {
    expect(gymErrors({ ...good, price_min: '10.5' }).price_min).toBeTruthy();
    expect(gymErrors({ ...good, price_max: '-1' }).price_max).toBeTruthy();
    expect(gymErrors({ ...good, price_min: '9000' }).price_min).toMatch(/above the maximum/);
  });
  it('rejects a point off the map', () => {
    expect(gymErrors({ ...good, latitude: '91' }).latitude).toBeTruthy();
    expect(gymErrors({ ...good, longitude: '-181' }).longitude).toBeTruthy();
  });
});

describe('toPayload / fromGym', () => {
  it('sends numbers as numbers and trims text', () => {
    const p = toPayload({ ...good, name: '  Baobab  ' });
    expect(p.name).toBe('Baobab');
    expect(p.latitude).toBe(-1.29);
    expect(p.price_min).toBe(3000);
  });
  it('fills the form from a server gym, tags as slugs', () => {
    const v = fromGym({ ...good, latitude: -1.29, tags: [{ name: 'Yoga', slug: 'yoga' }] });
    expect(v.latitude).toBe('-1.29');
    expect(v.tags).toEqual(['yoga']);
  });
});
