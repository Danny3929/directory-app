import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchListings, fetchListing, fetchZips } from './listings.js';
import listings from '../data/listings.json';
import zips from '../data/zips.json';

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchListings', () => {
  it('returns all the gyms after the delay', async () => {
    const result = await fetchListings({ delayMs: 0 });
    expect(result).toEqual(listings);
  });

  it('waits before answering, like a real server', async () => {
    vi.useFakeTimers();
    let done = false;
    fetchListings({ delayMs: 500 }).then(() => { done = true; });

    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it('fails on purpose with a friendly message when asked to', async () => {
    await expect(fetchListings({ delayMs: 0, fail: true }))
      .rejects.toThrow('Could not load gyms. Please try again.');
  });

  it('gives a copy, so changing the result does not change the data', async () => {
    const first = await fetchListings({ delayMs: 0 });
    first[0].name = 'Changed';
    first.pop();

    const second = await fetchListings({ delayMs: 0 });
    expect(second).toEqual(listings);
    expect(second[0].name).not.toBe('Changed');
  });
});

describe('fetchZips', () => {
  it('returns all the ZIPs', async () => {
    expect(await fetchZips({ delayMs: 0 })).toEqual(zips);
  });

  it('can fail on purpose too', async () => {
    await expect(fetchZips({ delayMs: 0, fail: true }))
      .rejects.toThrow('Could not load ZIP codes. Please try again.');
  });
});

describe('fetchListing', () => {
  it('returns the one gym with that id', async () => {
    const gym = await fetchListing(2, { delayMs: 0 });
    expect(gym).toEqual(listings.find((g) => g.id === 2));
  });

  it('returns null when no gym has that id', async () => {
    expect(await fetchListing(99999, { delayMs: 0 })).toBeNull();
  });

  it('fails on purpose with a friendly message when asked to', async () => {
    await expect(fetchListing(2, { delayMs: 0, fail: true }))
      .rejects.toThrow('Could not load this gym. Please try again.');
  });

  it('gives a copy, so changing the result does not change the data', async () => {
    const gym = await fetchListing(2, { delayMs: 0 });
    gym.name = 'Changed';
    const again = await fetchListing(2, { delayMs: 0 });
    expect(again.name).not.toBe('Changed');
  });
});
