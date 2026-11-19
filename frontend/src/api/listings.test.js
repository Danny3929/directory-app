import { describe, it, expect, vi } from 'vitest';
import {
  ApiError, fetchListings, fetchListing, fetchZips, fetchSimilarListings, fetchTagCounts, sendEnquiry, toGym,
} from './listings.js';
import listings from '../data/listings.json';
import zips from '../data/zips.json';
import { toApiGym } from '../test/fakeBackend.js';

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
// A backend that is switched off: fetch itself fails, like a refused connection.
const backendDown = () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

describe('toGym (API shape to page shape)', () => {
  it('turns every Task 2 gym into the same gym the pages already use', () => {
    for (const gym of listings) expect(toGym(toApiGym(gym))).toEqual(gym);
  });

  it('maps the snake_case names', () => {
    const gym = toGym(toApiGym(listings[0]));
    expect(gym.zip).toBe('00619');
    expect(gym.priceMin).toBe(5000);
    expect(gym.lat).toBe(-1.2885);
    expect(gym.tags).toEqual(['classes', 'beginner']);
    expect(gym.photoTag).toBe('classes');
  });

  it('finds the photo group from the first photo, not from the tag order', () => {
    const api = toApiGym({ ...listings[0], tags: ['beginner', 'yoga'], photos: ['yoga-2.webp'] });
    expect(toGym(api).photoTag).toBe('yoga');
  });
});

describe('fetchListings', () => {
  it('follows every page and returns all the gyms', async () => {
    const result = await fetchListings();
    expect(result).toEqual(listings);
    expect(fetch).toHaveBeenCalledTimes(4); // 45 gyms, 12 per page
  });

  it('asks the address in VITE_API_URL (default localhost:8000/api/v1)', async () => {
    await fetchListings();
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:8000/api/v1/listings/');
  });

  it('fails on purpose with a friendly message when asked to, without calling the server', async () => {
    await expect(fetchListings({ fail: true })).rejects.toThrow('Could not load gyms. Please try again.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('with the backend stopped: a plain message, no technical words', async () => {
    backendDown();
    const err = await fetchListings().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Could not load gyms. Please try again.');
    expect(err.message).not.toMatch(/fetch|TypeError/);
  });

  it('a server crash (500) also gives the plain message, never the server text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ error: { message: 'Traceback secret' } }, 500)));
    await expect(fetchListings()).rejects.toThrow('Could not load gyms. Please try again.');
  });

  it('an answer that is not JSON does not crash with a parse error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(fetchListings()).rejects.toThrow('Could not load gyms. Please try again.');
  });
});

describe('fetchZips', () => {
  it('returns all the ZIPs (they are not in the API)', async () => {
    expect(await fetchZips()).toEqual(zips);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('can fail on purpose too', async () => {
    await expect(fetchZips({ fail: true })).rejects.toThrow('Could not load ZIP codes. Please try again.');
  });
});

describe('fetchListing', () => {
  it('finds one gym by slug', async () => {
    expect(await fetchListing(listings[1].slug)).toEqual(listings[1]);
  });

  it('gives null for an unknown slug, so the page can say "not found"', async () => {
    expect(await fetchListing('no-such-gym')).toBeNull();
  });

  it('puts a slug with odd characters safely in the address', async () => {
    await fetchListing('a/b?c');
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:8000/api/v1/listings/a%2Fb%3Fc/');
  });

  it('with the backend stopped it fails; it does not pretend the gym is missing', async () => {
    backendDown();
    await expect(fetchListing(listings[1].slug)).rejects.toThrow('Could not load this gym. Please try again.');
  });

  it('fails on purpose with a friendly message when asked to', async () => {
    await expect(fetchListing(listings[1].slug, { fail: true })).rejects.toThrow('Could not load this gym.');
  });
});

describe('fetchSimilarListings', () => {
  it('gives at most 3 gyms, never the gym itself', async () => {
    const result = await fetchSimilarListings('flexline-fitness');
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.some((g) => g.slug === 'flexline-fitness')).toBe(false);
  });

  it('gives [] for an unknown slug', async () => {
    expect(await fetchSimilarListings('no-such-gym')).toEqual([]);
  });

  it('with the backend stopped: a plain message', async () => {
    backendDown();
    await expect(fetchSimilarListings('flexline-fitness')).rejects.toThrow('Could not load similar gyms.');
  });
});

describe('fetchTagCounts', () => {
  it('counts gyms per tag', async () => {
    const counts = await fetchTagCounts();
    expect(counts.classes).toBe(listings.filter((g) => g.tags.includes('classes')).length);
  });
});

describe('sendEnquiry', () => {
  const good = { name: 'Ana', email: 'ana@example.com', message: 'Evening classes?' };

  it('posts JSON to the gym enquiry address', async () => {
    await sendEnquiry('flexline-fitness', good);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/listings/flexline-fitness/enquiries/');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual(good);
  });

  it('sends only the three boxes, whatever else is passed in', async () => {
    await sendEnquiry('flexline-fitness', { ...good, is_read: true, listing: 9 });
    expect(Object.keys(JSON.parse(fetch.mock.calls[0][1].body))).toEqual(['name', 'email', 'message']);
  });

  it('a 400 carries the API message and the wrong boxes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({
      error: { code: 'invalid', message: 'Please check the highlighted fields.', fields: { email: ['Bad.'] } },
    }, 400)));
    const err = await sendEnquiry('x', good).catch((e) => e);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Please check the highlighted fields.');
    expect(err.fields).toEqual({ email: ['Bad.'] });
  });

  it('a 429 carries the API message about too many messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({
      error: { code: 'throttled', message: 'Too many messages.', fields: {} },
    }, 429)));
    const err = await sendEnquiry('x', good).catch((e) => e);
    expect(err.status).toBe(429);
    expect(err.message).toBe('Too many messages.');
  });

  it('an unknown gym (404) gives the plain message', async () => {
    await expect(sendEnquiry('no-such-gym', good)).rejects.toThrow('Could not send your message. Please try again.');
  });

  it('with the backend stopped: a plain message and status 0', async () => {
    backendDown();
    const err = await sendEnquiry('x', good).catch((e) => e);
    expect(err.status).toBe(0);
    expect(err.message).toBe('Could not send your message. Please try again.');
  });
});
