// How a gym's monthly price is shown, e.g. "Ksh 3,000 – 4,500".
// priceMin is the cheapest plan, priceMax the dearest. Plain function, no React.

// 4000 -> '4,000'
export const formatKsh = (n) => n.toLocaleString('en-US');
const ksh = formatKsh;

export function formatPrice({ priceMin, priceMax }) {
  if (priceMax == null || priceMax === priceMin) return `Ksh ${ksh(priceMin)}`;
  return `Ksh ${ksh(priceMin)} – ${ksh(priceMax)}`;
}

// The dearest plan; a gym with no priceMax has only its starting price.
export const topPrice = (gym) => gym.priceMax ?? gym.priceMin;

// Dan's rule: an over-budget gym still shows, but its card says some plans cost more than Max.
export function isOverBudget(gym, max) {
  return max != null && topPrice(gym) > max;
}

// '' when the two boxes make sense; otherwise the message the page shows.
export function priceRangeError(min, max) {
  return min != null && max != null && min > max ? 'Min is more than Max, so the price filter is off.' : '';
}

// Words for the empty-state message: "between Ksh 5,500 and 7,500", "up to Ksh 4,000", "from Ksh 6,000".
export function priceText(min, max) {
  if (min != null && max != null) return `between Ksh ${ksh(min)} and ${ksh(max)}`;
  if (max != null) return `up to Ksh ${ksh(max)}`;
  return `from Ksh ${ksh(min)}`;
}
