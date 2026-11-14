import { describe, it, expect } from 'vitest';
import { parseSearch, buildSearch } from './urlState.js';

describe('parseSearch', () => {
  it('reads q, zip and sort from the address', () => {
    expect(parseSearch('?q=flex&zip=00619&sort=cheapest')).toEqual({
      q: 'flex',
      zip: '00619',
      sort: 'cheapest',
    });
  });

  it('uses empty text and the default sort when nothing is there', () => {
    expect(parseSearch('')).toEqual({ q: '', zip: '', sort: 'featured' });
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
    const filters = { q: 'yoga & pilates', zip: '00619', sort: 'distance' };
    expect(parseSearch(buildSearch(filters))).toEqual(filters);
  });
});
