// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, onSessionExpired } from './client.js';

const API = 'http://localhost:8000/api/v1';
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unauthorized = () => json({ error: { code: 'unauthorized', message: 'No.' } }, 401);

// Builds a fetch that answers from a script: routes[`${method} ${path}`] is a
// function (called each time) returning a Response.
function scriptedFetch(routes) {
  return vi.fn((url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${url.replace(API, '')}`;
    const route = routes[key];
    if (!route) throw new Error(`unexpected call: ${key}`);
    return Promise.resolve(route(init));
  });
}
const calls = (fetchMock, key) =>
  fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? 'GET'} ${url.replace(API, '')}` === key);

beforeEach(() => { document.cookie = 'csrftoken=abc123'; });
afterEach(() => { document.cookie = 'csrftoken=; max-age=0'; });

describe('apiFetch', () => {
  it('sends cookies, and the CSRF header only on unsafe methods', async () => {
    const fetchMock = scriptedFetch({ 'GET /x/': () => json({}), 'POST /x/': () => json({}) });
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/x/');
    await apiFetch('/x/', { method: 'POST', body: { a: 1 } });
    const [, get] = fetchMock.mock.calls[0];
    const [, post] = fetchMock.mock.calls[1];
    expect(get.credentials).toBe('include');
    expect(get.headers['X-CSRFToken']).toBeUndefined();
    expect(post.headers['X-CSRFToken']).toBe('abc123');
  });

  it('on 401 refreshes once and repeats the call', async () => {
    let attempt = 0;
    const fetchMock = scriptedFetch({
      'GET /me/listings/': () => (++attempt === 1 ? unauthorized() : json({ ok: true })),
      'POST /auth/refresh/': () => json({ id: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/me/listings/')).resolves.toEqual({ ok: true });
    expect(calls(fetchMock, 'POST /auth/refresh/')).toHaveLength(1);
    expect(calls(fetchMock, 'GET /me/listings/')).toHaveLength(2);
  });

  it('two requests failing together share ONE refresh', async () => {
    const seen = {};
    const fetchMock = scriptedFetch({
      'GET /a/': () => (seen.a++ ? json({ n: 'a' }) : unauthorized()),
      'GET /b/': () => (seen.b++ ? json({ n: 'b' }) : unauthorized()),
      'POST /auth/refresh/': () => json({ id: 1 }),
    });
    seen.a = 0; seen.b = 0;
    vi.stubGlobal('fetch', fetchMock);
    const [a, b] = await Promise.all([apiFetch('/a/'), apiFetch('/b/')]);
    expect([a.n, b.n]).toEqual(['a', 'b']);
    expect(calls(fetchMock, 'POST /auth/refresh/')).toHaveLength(1);
  });

  it('does not loop: a 401 after a good refresh is thrown, refresh called once', async () => {
    const fetchMock = scriptedFetch({
      'GET /a/': () => unauthorized(),
      'POST /auth/refresh/': () => json({ id: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/a/')).rejects.toMatchObject({ status: 401 });
    expect(calls(fetchMock, 'POST /auth/refresh/')).toHaveLength(1);
    expect(calls(fetchMock, 'GET /a/')).toHaveLength(2);
  });

  it('when the refresh fails, tells listeners and throws 401', async () => {
    const fetchMock = scriptedFetch({
      'GET /a/': () => unauthorized(),
      'POST /auth/refresh/': () => unauthorized(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const heard = vi.fn();
    const stop = onSessionExpired(heard);
    await expect(apiFetch('/a/')).rejects.toMatchObject({ status: 401 });
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });

  it('auth:false never refreshes (a wrong password is just a 401)', async () => {
    const fetchMock = scriptedFetch({ 'POST /auth/login/': () => unauthorized() });
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/auth/login/', { method: 'POST', body: {}, auth: false }))
      .rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns a network failure into a friendly ApiError with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(apiFetch('/a/')).rejects.toMatchObject({ status: 0, name: 'ApiError' });
  });
});
