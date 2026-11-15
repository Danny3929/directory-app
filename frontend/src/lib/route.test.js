import { describe, it, expect } from 'vitest';
import { parseRoute, gymPath } from './route.js';

describe('parseRoute', () => {
  it('shows the search page for an empty address or #/', () => {
    expect(parseRoute('')).toEqual({ page: 'search' });
    expect(parseRoute('#/')).toEqual({ page: 'search' });
    expect(parseRoute('#')).toEqual({ page: 'search' });
  });

  it('shows the detail page with the gym id as a number', () => {
    expect(parseRoute('#/gym/3')).toEqual({ page: 'gym', id: 3 });
  });

  it('allows a trailing slash', () => {
    expect(parseRoute('#/gym/12/')).toEqual({ page: 'gym', id: 12 });
  });

  it('gives not-found for an id that is not a whole number', () => {
    expect(parseRoute('#/gym/abc')).toEqual({ page: 'notfound' });
    expect(parseRoute('#/gym/2.5')).toEqual({ page: 'notfound' });
    expect(parseRoute('#/gym/')).toEqual({ page: 'notfound' });
    expect(parseRoute('#/gym/-1')).toEqual({ page: 'notfound' });
  });

  it('gives not-found for any other path', () => {
    expect(parseRoute('#/banana')).toEqual({ page: 'notfound' });
    expect(parseRoute('#/gym/3/extra')).toEqual({ page: 'notfound' });
  });
});

describe('gymPath', () => {
  it('builds the address for one gym', () => {
    expect(gymPath(7)).toBe('#/gym/7');
  });
});
