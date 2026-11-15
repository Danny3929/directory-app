import { describe, it, expect } from 'vitest';
import { formatPrice } from './price.js';

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
