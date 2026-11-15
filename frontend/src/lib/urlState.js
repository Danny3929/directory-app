// Turns the search choices into a web address and back, so a shared link
// opens the same search. Plain functions, no React.

export const SORTS = ['featured', 'cheapest', 'distance'];
export const DEFAULT_SORT = 'featured';
// The guide's four choices, in km. Anything else in ?radius= is ignored.
export const RADII = [5, 10, 25, 50];

// Anyone can edit the address by hand, so we cap the length and
// fall back to the default for a sort value we do not know.
const MAX_LENGTH = 100;
const MAX_TAGS = 10;
const TAG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// '?tags=Yoga,boxing,,yoga' -> ['boxing', 'yoga']: trimmed, lower case,
// no repeats, A to Z (so the same choice always makes the same link).
function parseTags(text) {
  const tags = (text ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => TAG_SHAPE.test(t));
  return [...new Set(tags)].sort().slice(0, MAX_TAGS);
}

export function parseSearch(search) {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  // Compare as text first, so '10.0' or '1e1' do not sneak in as 10.
  const radius = RADII.find((km) => String(km) === params.get('radius')) ?? null;
  return {
    q: (params.get('q') ?? '').slice(0, MAX_LENGTH),
    zip: (params.get('zip') ?? '').slice(0, MAX_LENGTH),
    sort: SORTS.includes(sort) ? sort : DEFAULT_SORT,
    saved: params.get('saved') === '1',
    radius,
    tags: parseTags(params.get('tags')),
  };
}

// Only choices that differ from the default go in the address, so the
// plain page keeps a clean URL. Returns '' or a string starting with '?'.
export function buildSearch({ q, zip, sort, saved, radius, tags }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (zip) params.set('zip', zip);
  if (sort && sort !== DEFAULT_SORT) params.set('sort', sort);
  if (saved) params.set('saved', '1');
  if (RADII.includes(radius)) params.set('radius', String(radius));
  if (tags?.length) params.set('tags', [...tags].sort().join(','));
  // URLSearchParams writes a comma as %2C; a plain comma is allowed and easier to read.
  const text = params.toString().replace(/%2C/g, ',');
  return text ? `?${text}` : '';
}
