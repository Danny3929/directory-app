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
  address: '1 Test Rd', area: 'Kilimani', city: 'Nairobi', priceMin: priceKsh, priceMax: priceKsh, isFeatured: featured, lat, lng,
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

describe('SearchPage photos', () => {
  it('has a top band with the headline; its photo is decorative (empty alt)', async () => {
    const { container } = render(<SearchPage />);
    expect(screen.getByRole('heading', { level: 1, name: /find a gym in nairobi/i })).toBeTruthy();
    expect(container.querySelector('.hero-photo').getAttribute('alt')).toBe('');
    await screen.findByText('Alpha Gym');
  });

  it('puts a lazy-loaded photo with alt text on every card', async () => {
    render(<SearchPage />);
    await screen.findByText('Alpha Gym');
    const photos = screen.getAllByRole('img', { name: /fitness class/i });
    expect(photos).toHaveLength(3);
    expect(photos[0].getAttribute('loading')).toBe('lazy');
  });

  it('shows the photo of the tag the visitor searched for', async () => {
    // classes is on 2 gyms, boxing on 1, so classes is more popular.
    fetchListings.mockResolvedValue([gyms[0], { ...gyms[2], tags: ['classes', 'boxing'] }]);
    render(<SearchPage />);
    await screen.findByText('Gamma Boxing');
    expect(screen.getAllByRole('img', { name: /fitness class/i })).toHaveLength(2);
    type(/search gyms/i, 'boxing');
    expect(screen.getByRole('img', { name: /sparring/i })).toBeTruthy();
  });
});

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

describe('SearchPage saved filter', () => {
  const box = () => screen.getByRole('checkbox', { name: /saved only/i });

  it('shows only saved gyms and writes saved=1 into the address', async () => {
    render(<SearchPage favourites={[2]} onToggleFavourite={() => {}} />);
    await screen.findByText('Alpha Gym');
    fireEvent.click(box());
    expect(names()).toEqual(['Beta Gym']);
    expect(window.location.search).toBe('?saved=1');
  });

  it('opens a shared saved link with the box ticked', async () => {
    window.history.replaceState(null, '', '/?saved=1');
    render(<SearchPage favourites={[3]} onToggleFavourite={() => {}} />);
    await screen.findByText('Gamma Boxing');
    expect(box().checked).toBe(true);
    expect(names()).toEqual(['Gamma Boxing']);
  });

  it('explains an empty saved list and offers all gyms', async () => {
    window.history.replaceState(null, '', '/?saved=1');
    render(<SearchPage favourites={[]} onToggleFavourite={() => {}} />);
    await screen.findByText(/no saved gyms yet/i);
    fireEvent.click(screen.getByRole('button', { name: /show all gyms/i }));
    await screen.findByText('Alpha Gym');
    expect(box().checked).toBe(false);
  });

  it('shows a "no longer available" card for a saved gym that is gone, and lets you remove it', async () => {
    window.history.replaceState(null, '', '/?saved=1');
    const onToggle = vi.fn();
    render(<SearchPage favourites={[99]} onToggleFavourite={onToggle} />);
    await screen.findByText(/no longer available/i);
    fireEvent.click(screen.getByRole('button', { name: /remove from saved/i }));
    expect(onToggle).toHaveBeenCalledWith(99);
  });

  it('combines with the text search', async () => {
    window.history.replaceState(null, '', '/?saved=1&q=alpha');
    render(<SearchPage favourites={[1, 2]} onToggleFavourite={() => {}} />);
    await screen.findByText('Alpha Gym');
    expect(names()).toEqual(['Alpha Gym']);
  });
});

describe('SearchPage radius filter (Dan spec 2026-11-15)', () => {
  // Delta is about 17 km from ZIP 00619; the other three are within about 2 km.
  const withFar = () => [...structuredClone(gyms), gym(4, 'Delta Gym', -1.2, 36.9, 1500)];
  const radius = () => screen.getByLabelText(/within/i);

  it('starts on Any distance, disabled until a ZIP is known, with a hint', async () => {
    render(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(radius().value).toBe('');
    expect(radius().disabled).toBe(true);
    expect(screen.getByText(/enter a zip to filter by distance/i)).toBeTruthy();
    expect(window.location.search).toBe('');
  });

  it('filters by distance once a ZIP is entered and writes ?radius= into the address', async () => {
    fetchListings.mockResolvedValue(withFar());
    render(<SearchPage />);
    await screen.findByText('Delta Gym');
    type(/your zip/i, '00619');
    expect(radius().disabled).toBe(false);
    expect(screen.queryByText(/enter a zip to filter by distance/i)).toBeNull();
    type(/within/i, '5');
    expect(names()).not.toContain('Delta Gym');
    expect(names()).toHaveLength(3);
    expect(window.location.search).toBe('?zip=00619&radius=5');
    type(/within/i, '25');
    expect(names()).toContain('Delta Gym');
    type(/within/i, '');
    expect(window.location.search).toBe('?zip=00619');
  });

  it('opens a shared radius link with the same filter', async () => {
    fetchListings.mockResolvedValue(withFar());
    window.history.replaceState(null, '', '/?zip=00619&radius=10');
    render(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(radius().value).toBe('10');
    expect(names()).not.toContain('Delta Gym');
  });

  it('treats an unknown ZIP like no ZIP: radius off, all gyms, Did you mean list stays', async () => {
    fetchListings.mockResolvedValue(withFar());
    window.history.replaceState(null, '', '/?zip=99999&radius=5');
    render(<SearchPage />);
    await screen.findByText('Delta Gym');
    expect(names()).toHaveLength(4);
    expect(radius().disabled).toBe(true);
    // Off means it must not look like 5 km is being applied.
    expect(radius().value).toBe('');
    expect(screen.getByText(/pick a zip above to filter by distance/i)).toBeTruthy();
    expect(screen.getByText(/we don't recognise zip 99999/i)).toBeTruthy();
    // Picking a ZIP from the list turns the remembered radius back on.
    fireEvent.click(screen.getByRole('button', { name: /00619 kilimani/i }));
    expect(radius().disabled).toBe(false);
    expect(radius().value).toBe('5');
    expect(names()).not.toContain('Delta Gym');
  });

  it('says when nothing is inside the radius and offers Any distance', async () => {
    fetchListings.mockResolvedValue([gym(4, 'Delta Gym', -1.2, 36.9, 1500)]);
    render(<SearchPage />);
    await screen.findByText('Delta Gym');
    type(/your zip/i, '00619');
    type(/within/i, '5');
    expect(names()).toHaveLength(0);
    expect(screen.getByText(/no gyms within 5 km of 00619/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /show any distance/i }));
    expect(names()).toEqual(['Delta Gym']);
    expect(window.location.search).toBe('?zip=00619');
  });
});
