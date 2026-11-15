// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadFavourites, saveFavourites, toggleFavourite } from './favourites.js';

beforeEach(() => localStorage.clear());

describe('loadFavourites', () => {
  it('gives an empty list when nothing is saved', () => {
    expect(loadFavourites()).toEqual([]);
  });

  it('gives back what was saved', () => {
    saveFavourites([3, 7]);
    expect(loadFavourites()).toEqual([3, 7]);
  });

  it('gives an empty list when the saved text is not valid JSON', () => {
    localStorage.setItem('gym-favourites', '{oops');
    expect(loadFavourites()).toEqual([]);
  });

  it('gives an empty list when the saved value is not a list', () => {
    localStorage.setItem('gym-favourites', '{"a":1}');
    expect(loadFavourites()).toEqual([]);
  });

  it('keeps only whole-number ids and removes repeats', () => {
    localStorage.setItem('gym-favourites', '[1,"2",null,1,2.5,4]');
    expect(loadFavourites()).toEqual([1, 4]);
  });
});

describe('toggleFavourite', () => {
  it('adds an id that is not there', () => {
    expect(toggleFavourite([1], 2)).toEqual([1, 2]);
  });

  it('removes an id that is there', () => {
    expect(toggleFavourite([1, 2], 1)).toEqual([2]);
  });

  it('does not change the list it was given', () => {
    const list = [1];
    toggleFavourite(list, 2);
    expect(list).toEqual([1]);
  });
});
