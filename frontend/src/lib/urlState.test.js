import { describe, it, expect } from 'vitest';
import { parseSearch, buildSearch } from './urlState.js';

describe('parseSearch', () => {
  it('reads q, zip and sort from the address', () => {
    expect(parseSearch('?q=flex&zip=00619&sort=cheapest')).toEqual({
      q: 'flex',
      zip: '00619',
      sort: 'cheapest',
      saved: false,
    });
  });

  it('uses empty text and the default sort when nothing is there', () => {
    expect(parseSearch('')).toEqual({ q: '', zip: '', sort: 'featured', saved: false });
  });

  it('ignores a sort value we do not know', () => {
    expect(parseSearch('?sort=banana').sort).toBe('featured');
  });
});

describe('buildSearch', () => {
  it('writes only the choices that are set', () => {
    expect(buildSearch({ q: 'flex', zip: '', sort: 'featured' })).toBe('?q=flex');
  });

  it('gives an empty string when everything is default', () => {
    expect(buildSearch({ q: '', zip: '', sort: 'featured' })).toBe('');
  });

  it('round-trips, including spaces and symbols', () => {
    const filters = { q: 'yoga & pilates', zip: '00619', sort: 'distance', saved: true };
    expect(parseSearch(buildSearch(filters))).toEqual(filters);
  });
});

describe('saved flag', () => {
  it('reads ?saved=1 as true and anything else as false', () => {
    expect(parseSearch('?saved=1').saved).toBe(true);
    expect(parseSearch('?saved=yes').saved).toBe(false);
    expect(parseSearch('').saved).toBe(false);
  });

  it('writes saved=1 only when it is on', () => {
    expect(buildSearch({ q: '', zip: '', sort: 'featured', saved: true })).toBe('?saved=1');
    expect(buildSearch({ q: '', zip: '', sort: 'featured', saved: false })).toBe('');
  });
});
