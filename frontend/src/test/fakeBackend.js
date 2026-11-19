// A stand-in for the Django API, used by tests so they need no server.
// It answers like the real one (snake_case, 12 per page, one error shape),
// built from the same Task 2 JSON the seed command loads.
import listings from '../data/listings.json';

export const API = 'http://localhost:8000/api/v1';
const PAGE = 12;

// Task 2 gym -> what Django sends.
export function toApiGym(g) {
  return {
    id: g.id, slug: g.slug, name: g.name, description: g.description,
    address: g.address, area: g.area, city: g.city, zip_code: g.zip,
    latitude: g.lat, longitude: g.lng, price_min: g.priceMin, price_max: g.priceMax,
    tags: g.tags.map((t) => ({ name: t, slug: t })),
    images: g.photos.map((p) => ({ image: p, alt_text: g.name })),
    is_featured: g.isFeatured, distance_km: null,
  };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const notFound = () => json({ error: { code: 'not_found', message: 'Not found.', fields: {} } }, 404);

export function fakeFetch(url, init = {}) {
  const { pathname, searchParams } = new URL(url);
  const path = pathname.replace(/^\/api\/v1/, '');
  if (path === '/listings/') {
    const page = Number(searchParams.get('page') ?? 1);
    const slice = listings.slice((page - 1) * PAGE, page * PAGE).map(toApiGym);
    const more = page * PAGE < listings.length;
    return Promise.resolve(json({
      count: listings.length,
      next: more ? `${API}/listings/?page=${page + 1}` : null,
      previous: null,
      results: slice,
    }));
  }
  const one = path.match(/^\/listings\/([^/]+)\/$/);
  if (one) {
    const gym = listings.find((g) => g.slug === one[1]);
    return Promise.resolve(gym ? json(toApiGym(gym)) : notFound());
  }
  const enquiry = path.match(/^\/listings\/([^/]+)\/enquiries\/$/);
  if (enquiry && init.method === 'POST') {
    return Promise.resolve(listings.some((g) => g.slug === enquiry[1])
      ? json({ id: 1, detail: 'Thank you.' }, 201)
      : notFound());
  }
  return Promise.resolve(notFound());
}
