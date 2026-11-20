import { beforeEach, vi } from 'vitest';
import { fakeFetch } from './fakeBackend.js';

// Tests must not depend on a developer's local frontend/.env (for example one
// that points at port 8010). Pin the address the tests expect.
vi.stubEnv('VITE_API_URL', 'http://localhost:8000/api/v1');

// Every test starts with a working fake backend. A test that wants a broken
// one replaces it with vi.stubGlobal('fetch', ...).
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
});
