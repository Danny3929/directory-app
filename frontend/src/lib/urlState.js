// Turns the search choices into a web address and back, so a shared link
// opens the same search. Plain functions, no React.

export const SORTS = ['featured', 'cheapest', 'distance'];
export const DEFAULT_SORT = 'featured';

// Anyone can edit the address by hand, so we cap the length and
// fall back to the default for a sort value we do not know.
const MAX_LENGTH = 100;

export function parseSearch(search) {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  return {
    q: (params.get('q') ?? '').slice(0, MAX_LENGTH),
    zip: (params.get('zip') ?? '').slice(0, MAX_LENGTH),
    sort: SORTS.includes(sort) ? sort : DEFAULT_SORT,
    saved: params.get('saved') === '1',
  };
}

// Only choices that differ from the default go in the address, so the
// plain page keeps a clean URL. Returns '' or a string starting with '?'.
export function buildSearch({ q, zip, sort, saved }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (zip) params.set('zip', zip);
  if (sort && sort !== DEFAULT_SORT) params.set('sort', sort);
  if (saved) params.set('saved', '1');
  const text = params.toString();
  return text ? `?${text}` : '';
}
