// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import FavouritesPage from './FavouritesPage.jsx';
import { fetchListings } from '../api/listings.js';

vi.mock('../api/listings.js', () => ({ fetchListings: vi.fn() }));

const gym = (id, name) => ({
  id, name, slug: name.toLowerCase().replace(/ /g, '-'), description: 'd', tags: ['classes'],
  address: '1 Test Rd', area: 'Kilimani', city: 'Nairobi', priceMin: 3000, priceMax: 4000,
  isFeatured: false, lat: -1.29, lng: 36.78,
});

const show = (props) =>
  render(
    <MemoryRouter initialEntries={['/favourites']}>
      <FavouritesPage onToggleFavourite={() => {}} {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  fetchListings.mockReset().mockResolvedValue([gym(1, 'Alpha Gym'), gym(2, 'Beta Gym'), gym(3, 'Cedar Gym')]);
});
afterEach(cleanup);

describe('FavouritesPage', () => {
  it('says loading first, then shows the saved gyms in A to Z order', async () => {
    show({ favourites: [3, 1] });
    expect(screen.getByRole('status').textContent).toMatch(/loading/i);
    const links = await screen.findAllByRole('link', { name: /gym$/i });
    expect(links.map((a) => a.textContent)).toEqual(['Alpha Gym', 'Cedar Gym']);
    expect(screen.getByText('2 saved gyms')).toBeTruthy();
  });

  it('with nothing saved, explains the heart and links to the search', async () => {
    show({ favourites: [] });
    await screen.findByText(/no saved gyms yet/i);
    expect(screen.getByRole('link', { name: /find a gym/i }).getAttribute('href')).toBe('/');
  });

  it('shows a "no longer available" card for a saved gym that is gone, with Remove', async () => {
    const onToggle = vi.fn();
    show({ favourites: [2, 99], onToggleFavourite: onToggle });
    await screen.findByRole('link', { name: 'Beta Gym' });
    expect(screen.getByText(/no longer available/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /remove from saved/i }));
    expect(onToggle).toHaveBeenCalledWith(99);
  });

  it('shows the error and Try again works', async () => {
    fetchListings.mockRejectedValueOnce(new Error('Could not load gyms. Please try again.'));
    show({ favourites: [1] });
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not load gyms/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByRole('link', { name: 'Alpha Gym' });
  });
});
