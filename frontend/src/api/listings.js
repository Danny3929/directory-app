// Server calls. These talk to the Django API (backend/). The address comes
// from VITE_API_URL (see .env.example); the pages never see the API's own
// field names, because toGym() turns each gym into the shape they already use.
import zips from '../data/zips.json';
import { PHOTOS, tagCounts } from '../lib/gymImage.js';
import { similarGyms } from '../lib/similar.js';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api').replace(/\/+$/, '');

// Anything that goes wrong becomes an Error with a message safe to show.
// status is the HTTP status, or 0 when the server could not be reached.
export class ApiError extends Error {
  constructor(message, { status = 0, fields = {} } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

// Sends one request. Gives back the parsed JSON, or throws ApiError.
async function request(url, { method = 'GET', body, errorMessage }) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Backend stopped, no network, or blocked by CORS.
    throw new ApiError(errorMessage, { status: 0 });
  }
  if (!response.ok) {
    // The API always answers errors as { error: { code, message, fields } }.
    const data = await response.json().catch(() => ({}));
    const message = response.status === 404 || response.status >= 500
      ? errorMessage
      : data?.error?.message || errorMessage;
    throw new ApiError(message, { status: response.status, fields: data?.error?.fields ?? {} });
  }
  return response.json();
}

// The photo group a gym belongs to (e.g. "classes"), found from its first photo.
function photoTagFor(photos, tags) {
  const found = Object.keys(PHOTOS).find((tag) => PHOTOS[tag].some((p) => p.file === photos[0]));
  return found ?? tags[0];
}

// API gym (snake_case, tags and photos as objects) -> the shape the pages use.
export function toGym(api) {
  const tags = (api.tags ?? []).map((t) => t.slug);
  const photos = (api.images ?? []).map((i) => i.image);
  return {
    id: api.id,
    slug: api.slug,
    name: api.name,
    description: api.description,
    address: api.address,
    area: api.area,
    city: api.city,
    zip: api.zip_code,
    lat: api.latitude,
    lng: api.longitude,
    priceMin: api.price_min,
    priceMax: api.price_max,
    tags,
    photoTag: photoTagFor(photos, tags),
    photos,
    isFeatured: api.is_featured,
  };
}

// 'fail' is a demo switch (?fail=1 on the search page) that shows the error state.
function demoFail(fail, message) {
  if (fail) throw new ApiError(message);
}

// Every published gym. The API sends 12 per page, so follow "next" until it is
// null. (The search page still filters in the browser; the API can filter too.)
export async function fetchListings({ fail = false } = {}) {
  const errorMessage = 'Could not load gyms. Please try again.';
  demoFail(fail, errorMessage);
  const gyms = [];
  let url = `${API_URL}/listings/`;
  while (url) {
    const page = await request(url, { errorMessage });
    gyms.push(...page.results.map(toGym));
    url = page.next;
  }
  return gyms;
}

// ZIP codes are not in the API (they are only used to find a place on the map).
export async function fetchZips({ fail = false } = {}) {
  demoFail(fail, 'Could not load ZIP codes. Please try again.');
  return structuredClone(zips);
}

// How many gyms have each tag, e.g. { classes: 15, yoga: 5 }.
export async function fetchTagCounts(options = {}) {
  return tagCounts(await fetchListings(options));
}

// One gym by its slug (the name part of /listing/baobab-barbell), or null when
// there is no such gym (the page shows "not found").
export async function fetchListing(slug, { fail = false } = {}) {
  const errorMessage = 'Could not load this gym. Please try again.';
  demoFail(fail, errorMessage);
  try {
    return toGym(await request(`${API_URL}/listings/${encodeURIComponent(slug)}/`, { errorMessage }));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Up to 3 gyms like this one (Dan's rule in lib/similar.js), or [] for an
// unknown slug. The API has no "similar" endpoint yet, so this uses all gyms.
export async function fetchSimilarListings(slug, { fail = false } = {}) {
  demoFail(fail, 'Could not load similar gyms.');
  let all;
  try {
    all = await fetchListings();
  } catch {
    throw new ApiError('Could not load similar gyms.');
  }
  const gym = all.find((g) => g.slug === slug);
  return gym ? similarGyms(gym, all) : [];
}

// Sends an enquiry to a gym. Resolves on success. On failure throws an ApiError
// whose message is safe to show and whose fields say which box was wrong.
export async function sendEnquiry(slug, { name, email, message }) {
  await request(`${API_URL}/listings/${encodeURIComponent(slug)}/enquiries/`, {
    method: 'POST',
    body: { name, email, message },
    errorMessage: 'Could not send your message. Please try again.',
  });
}
