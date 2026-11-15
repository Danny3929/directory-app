import { describe, it, expect } from 'vitest';
import { formatPrice, isOverBudget, priceRangeError, priceText } from './price.js';

describe('formatPrice', () => {
  it('shows a range when the plans cost different amounts', () => {
    expect(formatPrice({ priceMin: 3000, priceMax: 4500 })).toBe('Ksh 3,000 – 4,500');
  });

  it('shows one price when the cheapest and dearest plan are the same', () => {
    expect(formatPrice({ priceMin: 3000, priceMax: 3000 })).toBe('Ksh 3,000');
  });

  it('shows one price when there is no top price', () => {
    expect(formatPrice({ priceMin: 12000 })).toBe('Ksh 12,000');
  });
});

describe('isOverBudget (Dan spec: show the gym, but mark it)', () => {
  const mid = { priceMin: 3000, priceMax: 5000 };

  it('is true when some plans cost more than Max', () => {
    expect(isOverBudget(mid, 4000)).toBe(true);
  });

  it('is false when every plan fits, including exactly on Max', () => {
    expect(isOverBudget(mid, 5000)).toBe(false);
  });

  it('is false when no Max is set', () => {
    expect(isOverBudget(mid, null)).toBe(false);
  });

  it('uses the starting price when there is no priceMax', () => {
    expect(isOverBudget({ priceMin: 3000 }, 3000)).toBe(false);
  });
});

describe('priceRangeError', () => {
  it('explains when Min is more than Max', () => {
    expect(priceRangeError(6000, 2000)).toMatch(/min.*more than.*max/i);
  });

  it('is empty when the range makes sense or a box is empty', () => {
    expect(priceRangeError(2000, 6000)).toBe('');
    expect(priceRangeError(4000, 4000)).toBe('');
    expect(priceRangeError(null, 2000)).toBe('');
    expect(priceRangeError(6000, null)).toBe('');
  });
});

describe('priceText', () => {
  it('words the range for the empty-state message', () => {
    expect(priceText(5500, 7500)).toBe('between Ksh 5,500 and 7,500');
    expect(priceText(null, 4000)).toBe('up to Ksh 4,000');
    expect(priceText(6000, null)).toBe('from Ksh 6,000');
  });
});
