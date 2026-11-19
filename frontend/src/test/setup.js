import { beforeEach, vi } from 'vitest';
import { fakeFetch } from './fakeBackend.js';

// Every test starts with a working fake backend. A test that wants a broken
// one replaces it with vi.stubGlobal('fetch', ...).
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
});
