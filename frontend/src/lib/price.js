// How a gym's monthly price is shown, e.g. "Ksh 3,000 – 4,500".
// priceMin is the cheapest plan, priceMax the dearest. Plain function, no React.

const ksh = (n) => n.toLocaleString('en-US');

export function formatPrice({ priceMin, priceMax }) {
  if (priceMax == null || priceMax === priceMin) return `Ksh ${ksh(priceMin)}`;
  return `Ksh ${ksh(priceMin)} – ${ksh(priceMax)}`;
}
