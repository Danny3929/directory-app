import { describe, it, expect } from 'vitest';
import { parseSearch, buildSearch } from './urlState.js';

describe('parseSearch', () => {
  it('reads q, zip and sort from the address', () => {
    expect(parseSearch('?q=flex&zip=00619&sort=cheapest')).toEqual({
      q: 'flex',
      zip: '00619',
      sort: 'cheapest',
      saved: false,
      radius: null,
      tags: [],
    });
  });

  it('uses empty text and the default sort when nothing is there', () => {
    expect(parseSearch('')).toEqual({ q: '', zip: '', sort: 'featured', saved: false, radius: null, tags: [] });
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
    const filters = { q: 'yoga & pilates', zip: '00619', sort: 'distance', saved: true, radius: 10, tags: ['boxing', 'strength'] };
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

describe('radius', () => {
  it('reads the four allowed radii as numbers', () => {
    for (const km of [5, 10, 25, 50]) expect(parseSearch(`?radius=${km}`).radius).toBe(km);
  });

  it('ignores missing, unknown or odd radius values', () => {
    for (const bad of ['', '?radius=', '?radius=7', '?radius=abc', '?radius=-5', '?radius=10.0', '?radius=1e1']) {
      expect(parseSearch(bad).radius).toBeNull();
    }
  });

  it('writes radius only when one is picked', () => {
    expect(buildSearch({ q: '', zip: '00619', sort: 'featured', radius: 10 })).toBe('?zip=00619&radius=10');
    expect(buildSearch({ q: '', zip: '', sort: 'featured', radius: null })).toBe('');
  });
});

describe('tags (Dan spec 2026-11-15: ?tags=a,b)', () => {
  it('reads a comma list, trimmed, lower case, without repeats, A to Z', () => {
    expect(parseSearch('?tags=yoga,boxing').tags).toEqual(['boxing', 'yoga']);
    expect(parseSearch('?tags=%20Boxing%20,,boxing,YOGA').tags).toEqual(['boxing', 'yoga']);
    expect(parseSearch('?tags=personal-training').tags).toEqual(['personal-training']);
  });

  it('gives an empty list for no tags and drops values that are not tag-shaped', () => {
    expect(parseSearch('').tags).toEqual([]);
    expect(parseSearch('?tags=').tags).toEqual([]);
    expect(parseSearch('?tags=<script>,a b,boxing').tags).toEqual(['boxing']);
  });

  it('keeps at most 10 tags from a hand-edited address', () => {
    const many = Array.from({ length: 30 }, (_, i) => `t${String(i).padStart(2, '0')}`).join(',');
    expect(parseSearch(`?tags=${many}`).tags).toHaveLength(10);
  });

  it('writes tags as one readable comma list, only when some are picked', () => {
    expect(buildSearch({ q: '', zip: '', sort: 'featured', tags: ['yoga', 'boxing'] })).toBe('?tags=boxing,yoga');
    expect(buildSearch({ q: '', zip: '', sort: 'featured', tags: [] })).toBe('');
  });
});
