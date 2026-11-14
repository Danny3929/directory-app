// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SearchPage from './SearchPage.jsx';
import { fetchListings, fetchZips } from '../api/listings.js';

// The page must get its data through src/api/, so we replace that module
// with instant fakes. No timers, no real data.
vi.mock('../api/listings.js', () => ({
  fetchListings: vi.fn(),
  fetchZips: vi.fn(),
}));

const gym = (id, name, lat, lng, priceKsh, featured = false) => ({
  id, name, description: `${name} description`, tags: ['classes'],
  address: '1 Test Rd', area: 'Kilimani', city: 'Nairobi', priceKsh, featured, lat, lng,
});

const gyms = [
  gym(1, 'Alpha Gym', -1.29, 36.78, 3000),
  gym(2, 'Beta Gym', -1.3, 36.8, 2000, true),
  gym(3, 'Gamma Boxing', -1.28, 36.77, 2500),
];
const zips = [
  { zip: '00619', label: 'Kilimani', lat: -1.29, lng: 36.785 },
  { zip: '00100', label: 'Nairobi CBD', lat: -1.2864, lng: 36.8172 },
];

const names = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  fetchListings.mockReset().mockResolvedValue(structuredClone(gyms));
  fetchZips.mockReset().mockResolvedValue(structuredClone(zips));
});

afterEach(cleanup);

describe('SearchPage', () => {
  it('shows a loading message, then the gyms', async () => {
    render(<SearchPage />);
    expect(screen.getByText(/loading gyms/i)).toBeTruthy();
    await screen.findByText('Alpha Gym');
    expect(screen.queryByText(/loading gyms/i)).toBeNull();
    expect(names()).toHaveLength(3);
  });

  it('filters by text and writes the search into the address', async () => {
    render(<SearchPage />);
    await screen.findByText('Alpha Gym');
    type(/search gyms/i, 'box');
    expect(names()).toEqual(['Gamma Boxing']);
    expect(window.location.search).toBe('?q=box');
  });

  it('opens a shared link with the same search', async () => {
    window.history.replaceState(null, '', '/?q=gym&sort=cheapest');
    render(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(screen.getByLabelText(/search gyms/i).value).toBe('gym');
    expect(names()).toEqual(['Beta Gym', 'Alpha Gym']);
  });

  it('shows an empty state with a way back', async () => {
    render(<SearchPage />);
    await screen.findByText('Alpha Gym');
    type(/search gyms/i, 'zzz');
    expect(screen.getByText(/no gyms match/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(names()).toHaveLength(3);
  });

  it('shows an error with Try again, and recovers', async () => {
    fetchListings.mockRejectedValueOnce(new Error('Could not load gyms. Please try again.'));
    render(<SearchPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not load gyms');
    expect(names()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByText('Alpha Gym');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says an unknown ZIP is not recognised and lets the user pick one', async () => {
    window.history.replaceState(null, '', '/?sort=distance');
    render(<SearchPage />);
    await screen.findByText('Alpha Gym');

    type(/your zip/i, '00999');
    expect(screen.getByText(/we don't recognise zip 00999/i)).toBeTruthy();
    expect(screen.getByText(/not sorted by distance/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '00619 Kilimani' }));
    expect(screen.queryByText(/we don't recognise/i)).toBeNull();
    expect(screen.queryByText(/not sorted by distance/i)).toBeNull();
    expect(names()[0]).toBe('Alpha Gym');
    expect(screen.getAllByText(/\d\.\d\d km/).length).toBe(3);
  });

  it('does not call a half-typed ZIP invalid', async () => {
    render(<SearchPage />);
    await screen.findByText('Alpha Gym');
    type(/your zip/i, '006');
    expect(screen.queryByText(/we don't recognise/i)).toBeNull();
    expect(screen.getByText(/5 digits/i)).toBeTruthy();
  });
});
