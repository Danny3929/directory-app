// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import App from './App.jsx';
import { fetchListings, fetchZips, fetchListing } from './api/listings.js';

vi.mock('./api/listings.js', () => ({
  fetchListings: vi.fn(),
  fetchZips: vi.fn(),
  fetchListing: vi.fn(),
  fetchTagCounts: vi.fn(async () => ({})),
}));

const gym = (id, name) => ({
  id, name, description: `${name} description`, tags: ['classes'],
  address: '1 Test Rd', area: 'Kilimani', city: 'Nairobi', priceKsh: 3000,
  featured: false, lat: -1.29, lng: 36.78,
});
const gyms = [gym(1, 'Alpha Gym'), gym(2, 'Beta Gym')];

const goTo = (hash) => act(() => {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  fetchListings.mockReset().mockResolvedValue(structuredClone(gyms));
  fetchZips.mockReset().mockResolvedValue([]);
  fetchListing.mockReset().mockImplementation(async (id) => structuredClone(gyms.find((g) => g.id === id) ?? null));
});
afterEach(cleanup);

describe('App routing', () => {
  it('card names link to the detail page', async () => {
    render(<App />);
    const link = await screen.findByRole('link', { name: 'Beta Gym' });
    expect(link.getAttribute('href')).toBe('#/gym/2');
  });

  it('shows the detail page for #/gym/2, and the search page again on Back', async () => {
    window.history.replaceState(null, '', '/?q=gym#/gym/2');
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'Beta Gym' });
    await goTo('#/');
    await screen.findByRole('link', { name: 'Alpha Gym' });
    // The search choice is still in the address.
    expect(window.location.search).toBe('?q=gym');
  });

  it('shows a not-found page for an unknown address', async () => {
    window.history.replaceState(null, '', '/#/nonsense');
    render(<App />);
    expect(screen.getByText(/page not found/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to search/i }).getAttribute('href')).toBe('#/');
  });
});

describe('App favourites', () => {
  it('saves a favourite from a card and remembers it after a reload', async () => {
    const { unmount } = render(<App />);
    const heart = await screen.findByRole('button', { name: 'Save Alpha Gym' });
    expect(heart.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(heart);
    expect(screen.getByRole('button', { name: 'Save Alpha Gym' }).getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('gym-favourites'))).toEqual([1]);
    unmount();
    render(<App />);
    expect((await screen.findByRole('button', { name: 'Save Alpha Gym' })).getAttribute('aria-pressed')).toBe('true');
  });

  it('the detail page heart shares the same saved list', async () => {
    window.history.replaceState(null, '', '/#/gym/2');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save Beta Gym' }));
    expect(JSON.parse(localStorage.getItem('gym-favourites'))).toEqual([2]);
  });

  it('the detail page heart starts pressed for a saved gym', async () => {
    localStorage.setItem('gym-favourites', '[2]');
    window.history.replaceState(null, '', '/#/gym/2');
    render(<App />);
    const heart = await screen.findByRole('button', { name: 'Save Beta Gym' });
    expect(heart.getAttribute('aria-pressed')).toBe('true');
  });
});
