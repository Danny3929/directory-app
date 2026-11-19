import { describe, it, expect } from 'vitest';
import { parseSearch, buildSearch } from './urlState.js';

describe('parseSearch', () => {
  it('reads q, zip and sort from the address', () => {
    expect(parseSearch('?q=flex&zip=00619&sort=cheapest')).toEqual({
      q: 'flex',
      zip: '00619',
      sort: 'cheapest',
      radius: null,
      tags: [],
      min: null,
      max: null,
      page: 1,
    });
  });

  it('uses empty text and the default sort when nothing is there', () => {
    expect(parseSearch('')).toEqual({ q: '', zip: '', sort: 'featured', radius: null, tags: [], min: null, max: null, page: 1 });
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
    const filters = { q: 'yoga & pilates', zip: '00619', sort: 'distance', radius: 10, tags: ['boxing', 'strength'], min: 2000, max: 5000, page: 3 };
    expect(parseSearch(buildSearch(filters))).toEqual(filters);
  });
});

describe('old saved flag (Dan 2026-11-15: removed, the Saved gyms page replaces it)', () => {
  it('ignores ?saved=1, so it drops out of the address', () => {
    expect(parseSearch('?saved=1')).not.toHaveProperty('saved');
    expect(buildSearch(parseSearch('?q=box&saved=1'))).toBe('?q=box');
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

describe('price range (Dan spec 2026-11-15: ?min=&max= in Ksh)', () => {
  it('reads whole Ksh amounts as numbers', () => {
    expect(parseSearch('?min=2000&max=5000')).toMatchObject({ min: 2000, max: 5000 });
    expect(parseSearch('?max=4000')).toMatchObject({ min: null, max: 4000 });
  });

  it('ignores values that are not whole numbers of up to 6 digits', () => {
    for (const bad of ['?min=', '?min=abc', '?min=-500', '?min=4000.5', '?min=1e3', '?min=1234567', '?min=4%2C000']) {
      expect(parseSearch(bad).min).toBeNull();
    }
  });

  it('writes min and max only when set, and keeps 0', () => {
    expect(buildSearch({ q: '', zip: '', sort: 'featured', min: 2000, max: 5000 })).toBe('?min=2000&max=5000');
    expect(buildSearch({ q: '', zip: '', sort: 'featured', min: 0, max: null })).toBe('?min=0');
    expect(buildSearch({ q: '', zip: '', sort: 'featured', min: null, max: null })).toBe('');
  });
});

describe('Load more page (Dan spec 2026-11-15: ?page=, a new search starts at page 1)', () => {
  it('reads ?page= as how many lots of 12 are showing', () => {
    expect(parseSearch('?page=3').page).toBe(3);
  });

  it('ignores a page value that is not a whole number from 1 to 50', () => {
    for (const bad of ['0', '-1', '2.5', 'abc', '1e1', '51', '999', '']) {
      expect(parseSearch('?page=' + bad).page).toBe(1);
    }
  });

  it('leaves page 1 out of the address and writes the others', () => {
    expect(buildSearch({ q: '', zip: '', sort: 'featured', page: 1 })).toBe('');
    expect(buildSearch({ q: 'gym', zip: '', sort: 'featured', page: 2 })).toBe('?q=gym&page=2');
  });
});
