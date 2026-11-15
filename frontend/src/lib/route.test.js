import { describe, it, expect } from 'vitest';
import { gymPath, backLink, searchOf } from './route.js';

describe('gymPath', () => {
  it('builds the address for one gym from its slug', () => {
    expect(gymPath('baobab-barbell')).toBe('/listing/baobab-barbell');
  });
});

describe('backLink', () => {
  it('goes back to the same search the visitor came from', () => {
    expect(backLink({ from: '/?q=box&page=2' })).toEqual({ to: '/?q=box&page=2', label: 'Back to search' });
  });

  it('goes back to the saved gyms page when the visitor came from there', () => {
    expect(backLink({ from: '/favourites' })).toEqual({ to: '/favourites', label: 'Back to saved gyms' });
  });

  it('goes to the plain search page for a shared link (no state)', () => {
    expect(backLink(undefined)).toEqual({ to: '/', label: 'Back to search' });
    expect(backLink(null)).toEqual({ to: '/', label: 'Back to search' });
    expect(backLink({})).toEqual({ to: '/', label: 'Back to search' });
  });

  it('ignores anything that is not one of our own pages', () => {
    for (const from of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/listing/x', 42]) {
      expect(backLink({ from })).toEqual({ to: '/', label: 'Back to search' });
    }
  });
});

describe('searchOf', () => {
  it('gives the ?query part of where the visitor came from', () => {
    expect(searchOf({ from: '/?q=boxing' })).toBe('?q=boxing');
    expect(searchOf({ from: '/favourites' })).toBe('');
    expect(searchOf(undefined)).toBe('');
  });
});
