import { describe, it, expect } from 'vitest';
import { distanceKm } from './geo.js';
import { filterByText, filterByRadius, filterByTags, filterByPrice, sortByDistance, sortByCheapest, sortByFeatured } from './search.js';

// Tiny invented gyms, just for these tests.
const flex = { id: 1, name: 'Flex Gym', description: 'Weights and cardio', priceMin: 3000, isFeatured: false, lat: -1.29, lng: 36.78 };
const yoga = { id: 2, name: 'Calm Studio', description: 'Flexible yoga classes', priceMin: 2000, isFeatured: true, lat: -1.3, lng: 36.8 };
const box = { id: 3, name: 'Iron Box', description: 'Boxing and strength', priceMin: 2500, isFeatured: false, lat: -1.28, lng: 36.77 };
const all = [flex, yoga, box];

describe('filterByText', () => {
  it('finds a gym by name, ignoring upper/lower case', () => {
    expect(filterByText(all, 'FLEX GYM')).toEqual([flex]);
  });

  it('finds a gym by description', () => {
    expect(filterByText(all, 'boxing')).toEqual([box]);
  });

  it('matches part of a word, in the original order', () => {
    // "flex" is inside "Flex Gym" (name) and "Flexible" (description)
    expect(filterByText(all, 'flex')).toEqual([flex, yoga]);
  });

  it('returns everything for an empty or spaces-only query', () => {
    expect(filterByText(all, '')).toEqual(all);
    expect(filterByText(all, '   ')).toEqual(all);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterByText(all, 'swimming')).toEqual([]);
  });

  it('does not change the list it was given', () => {
    const copy = [...all];
    filterByText(all, 'flex');
    expect(all).toEqual(copy);
  });
});

describe('sortByDistance', () => {
  const origin = { lat: -1.29, lng: 36.78 }; // exactly at Flex Gym

  it('puts the nearest gym first and adds distanceKm', () => {
    const result = sortByDistance([yoga, box, flex], origin);
    expect(result.map((g) => g.id)).toEqual([1, 3, 2]);
    expect(result[0].distanceKm).toBe(0);
    expect(result[1].distanceKm).toBeGreaterThan(0);
  });

  it('sorts gyms A to Z by name when distances are equal, whatever the input order', () => {
    const a = { ...flex, id: 10, name: 'Zed' };
    const b = { ...flex, id: 11, name: 'alpha' }; // lower case on purpose: A to Z ignores case
    const c = { ...flex, id: 12, name: 'Mid' };
    expect(sortByDistance([a, b, c], origin).map((g) => g.id)).toEqual([11, 12, 10]);
    expect(sortByDistance([c, a, b], origin).map((g) => g.id)).toEqual([11, 12, 10]);
  });

  it('keeps the original order when the ZIP is missing (no origin)', () => {
    expect(sortByDistance([yoga, box, flex], null).map((g) => g.id)).toEqual([2, 3, 1]);
  });

  it('puts a gym with no coordinates last', () => {
    const lost = { id: 9, name: 'No Map', priceMin: 1 };
    expect(sortByDistance([lost, yoga, flex], origin).map((g) => g.id)).toEqual([1, 2, 9]);
  });

  it('returns an empty list for an empty list', () => {
    expect(sortByDistance([], origin)).toEqual([]);
  });

  it('does not change the list it was given', () => {
    const input = [yoga, box, flex];
    sortByDistance(input, origin);
    expect(input.map((g) => g.id)).toEqual([2, 3, 1]);
  });
});

describe('sortByCheapest', () => {
  it('puts the lowest price first and keeps data order for equal prices', () => {
    const same = { ...box, id: 4 };
    expect(sortByCheapest([flex, box, same, yoga]).map((g) => g.id)).toEqual([2, 3, 4, 1]);
  });
});

describe('sortByFeatured', () => {
  it('puts featured gyms first and keeps data order inside each group', () => {
    expect(sortByFeatured([flex, box, yoga]).map((g) => g.id)).toEqual([2, 1, 3]);
  });
});

describe('filterByRadius', () => {
  const origin = { lat: -1.29, lng: 36.78 };
  // About 1.1 km north of origin per 0.01 degrees of latitude.
  const near = { id: 1, name: 'Near', lat: -1.28, lng: 36.78 }; // ~1.1 km
  const mid = { id: 2, name: 'Mid', lat: -1.22, lng: 36.78 }; // ~7.8 km
  const far = { id: 3, name: 'Far', lat: -1.0, lng: 36.78 }; // ~32 km
  const noCoords = { id: 4, name: 'Nowhere' };
  const list = [near, mid, far, noCoords];

  it('keeps only gyms within the radius', () => {
    expect(filterByRadius(list, origin, 5).map((g) => g.name)).toEqual(['Near']);
    expect(filterByRadius(list, origin, 10).map((g) => g.name)).toEqual(['Near', 'Mid']);
    expect(filterByRadius(list, origin, 50).map((g) => g.name)).toEqual(['Near', 'Mid', 'Far']);
  });

  it('counts a gym exactly on the line as inside', () => {
    expect(filterByRadius([near], origin, distanceKm(-1.29, 36.78, -1.28, 36.78))).toHaveLength(1);
  });

  it('does nothing without a ZIP (no origin) or without a radius', () => {
    expect(filterByRadius(list, null, 5)).toEqual(list);
    expect(filterByRadius(list, origin, null)).toEqual(list);
  });

  it('does not change the list it is given', () => {
    const copy = [...list];
    filterByRadius(list, origin, 5);
    expect(list).toEqual(copy);
  });
});

describe('filterByTags (Dan spec: a gym must have ALL picked tags)', () => {
  const list = [
    { id: 1, name: 'A', tags: ['boxing', 'strength'] },
    { id: 2, name: 'B', tags: ['boxing'] },
    { id: 3, name: 'C', tags: ['yoga'] },
    { id: 4, name: 'D' },
  ];
  const ids = (gyms) => gyms.map((g) => g.id);

  it('keeps everything when no tag is picked', () => {
    expect(ids(filterByTags(list, []))).toEqual([1, 2, 3, 4]);
    expect(ids(filterByTags(list, undefined))).toEqual([1, 2, 3, 4]);
  });

  it('keeps gyms with the one picked tag', () => {
    expect(ids(filterByTags(list, ['boxing']))).toEqual([1, 2]);
  });

  it('needs every picked tag, so each extra tag narrows the list', () => {
    expect(ids(filterByTags(list, ['boxing', 'strength']))).toEqual([1]);
    expect(ids(filterByTags(list, ['boxing', 'yoga']))).toEqual([]);
  });

  it('does not change the list it was given', () => {
    const copy = structuredClone(list);
    filterByTags(list, ['boxing']);
    expect(list).toEqual(copy);
  });
});

describe('filterByPrice (Dan spec: show a gym if any of its plans fits the range)', () => {
  // Plans from priceMin to priceMax, like the real data.
  const cheap = { id: 1, name: 'Cheap', priceMin: 1500, priceMax: 2500 };
  const mid = { id: 2, name: 'Mid', priceMin: 3000, priceMax: 5000 };
  const dear = { id: 3, name: 'Dear', priceMin: 8000, priceMax: 11000 };
  const gyms = [cheap, mid, dear];
  const ids = (list) => list.map((g) => g.id);

  it('keeps everything when neither box is set', () => {
    expect(ids(filterByPrice(gyms, null, null))).toEqual([1, 2, 3]);
  });

  it("keeps a gym whose cheapest plan fits under Max (Dan's 3,000-5,000 vs 4,000 card)", () => {
    expect(ids(filterByPrice(gyms, null, 4000))).toEqual([1, 2]);
  });

  it('keeps a gym whose dearest plan reaches Min', () => {
    expect(ids(filterByPrice(gyms, 4000, null))).toEqual([2, 3]);
  });

  it('counts a plan exactly on either limit as inside', () => {
    expect(ids(filterByPrice(gyms, 5000, 8000))).toEqual([2, 3]);
  });

  it('drops gyms with no plan in the range', () => {
    expect(ids(filterByPrice(gyms, 5500, 7500))).toEqual([]);
  });

  it('ignores the filter when Min is more than Max (the page explains it)', () => {
    expect(ids(filterByPrice(gyms, 6000, 2000))).toEqual([1, 2, 3]);
  });

  it('uses the starting price as the top too when a gym has no priceMax', () => {
    expect(ids(filterByPrice([{ id: 9, priceMin: 3000 }], 3500, null))).toEqual([]);
  });

  it('does not change the list it is given', () => {
    const copy = structuredClone(gyms);
    filterByPrice(gyms, 2000, 4000);
    expect(gyms).toEqual(copy);
  });
});
