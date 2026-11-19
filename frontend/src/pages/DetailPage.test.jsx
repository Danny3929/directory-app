// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router';
import DetailPage from './DetailPage.jsx';
import { fetchListing, fetchTagCounts, fetchSimilarListings } from '../api/listings.js';

vi.mock('../api/listings.js', () => ({
  fetchListing: vi.fn(),
  fetchTagCounts: vi.fn(),
  fetchSimilarListings: vi.fn(),
}));

const gym = {
  id: 3, slug: 'baobab-barbell', name: 'Baobab Barbell', description: 'Boxing bags and coached sessions.',
  tags: ['boxing', 'strength'], address: '59 Wood Ave', area: 'Kilimani', city: 'Nairobi',
  priceMin: 3500, priceMax: 5000, isFeatured: true, lat: -1.29, lng: 36.78,
  photos: ['boxing.webp', 'strength.webp', 'weights.webp'],
};

const similar = [
  { ...gym, id: 7, slug: 'iron-house', name: 'Iron House', address: '2 Iron Rd', tags: ['weights'], photos: ['weights.webp'], isFeatured: false },
  { ...gym, id: 8, slug: 'jab-club', name: 'Jab Club', address: '8 Jab Lane', tags: ['strength'], photos: ['strength.webp'], description: 'Lifting.', isFeatured: false },
];

beforeEach(() => {
  fetchListing.mockReset().mockResolvedValue(structuredClone(gym));
  fetchTagCounts.mockReset().mockResolvedValue({ strength: 10, boxing: 5 });
  fetchSimilarListings.mockReset().mockResolvedValue(structuredClone(similar));
  window.history.replaceState(null, '', '/');
});

afterEach(cleanup);

// entry is where the router starts; its state is what a card link passes along.
const inRouter = (ui, entry = '/listing/baobab-barbell') => <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>;
const show = (props = {}, entry) => render(inRouter(<DetailPage slug="baobab-barbell" {...props} />, entry));

describe('DetailPage photo', () => {
  it('shows the most popular tag photo (strength) with alt text', async () => {
    show();
    await screen.findByText('Baobab Barbell');
    await screen.findByText('Baobab Barbell');
    const img = document.querySelector('.gallery-main');
    expect(img.getAttribute('alt')).toMatch(/lat machine/i);
    expect(img.getAttribute('src')).toMatch(/strength\.webp$/);
  });

  it('shows the boxing photo when the search in the address says boxing, like the card did', async () => {
    show({}, { pathname: '/listing/baobab-barbell', state: { from: '/?q=boxing' } });
    await screen.findByText('Baobab Barbell');
    const img = document.querySelector('.gallery-main');
    expect(img.getAttribute('alt')).toMatch(/sparring/i);
    expect(img.getAttribute('src')).toMatch(/boxing\.webp$/);
  });

  it('still shows the gym and a photo when the tag counts fail', async () => {
    fetchTagCounts.mockRejectedValue(new Error('down'));
    show();
    await screen.findByText('Baobab Barbell');
    // No counts: boxing and strength tie, so A to Z gives boxing.
    expect(document.querySelector('.gallery-main').getAttribute('src')).toMatch(/boxing\.webp$/);
  });
});

describe('DetailPage', () => {
  it('shows a loading message, then the gym', async () => {
    show();
    expect(screen.getByText(/loading gym/i)).toBeTruthy();
    await screen.findByRole('heading', { level: 1, name: 'Baobab Barbell' });
    expect(screen.queryByText(/loading gym/i)).toBeNull();
    expect(fetchListing.mock.calls[0][0]).toBe('baobab-barbell');
  });

  it('shows address, price, description and tags', async () => {
    show();
    await screen.findByText('Baobab Barbell');
    const own = within(screen.getByRole('article'));
    expect(own.getByText(/59 Wood Ave, Kilimani, Nairobi/)).toBeTruthy();
    expect(own.getByText(/Ksh 3,500/)).toBeTruthy();
    expect(own.getByText('Boxing bags and coached sessions.')).toBeTruthy();
    expect(own.getByText('strength')).toBeTruthy();
    expect(own.getByText('Featured')).toBeTruthy();
  });

  it('has a Back to search link that goes to the search page', async () => {
    show();
    await screen.findByText('Baobab Barbell');
    const back = screen.getByRole('link', { name: /back to search/i });
    expect(back.getAttribute('href')).toBe('/');
  });

  it('Back goes to the search the visitor came from', async () => {
    show({}, { pathname: '/listing/baobab-barbell', state: { from: '/?q=box&page=2' } });
    await screen.findByText('Baobab Barbell');
    expect(screen.getByRole('link', { name: /back to search/i }).getAttribute('href')).toBe('/?q=box&page=2');
  });

  it('says the gym was not found when there is no such gym', async () => {
    fetchListing.mockResolvedValue(null);
    show({ slug: 'no-such-gym' });
    await screen.findByText(/we could not find that gym/i);
    expect(screen.getByRole('heading', { level: 1, name: /gym not found/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to search/i })).toBeTruthy();
  });

  it('shows the error and a Try again button that loads again', async () => {
    fetchListing.mockRejectedValueOnce(new Error('Could not load this gym. Please try again.'));
    show();
    await screen.findByText('Could not load this gym. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByRole('heading', { level: 1, name: 'Baobab Barbell' });
    expect(fetchListing).toHaveBeenCalledTimes(2);
  });

  it('loads the new gym when the id changes', async () => {
    const { rerender } = show();
    await screen.findByText('Baobab Barbell');
    fetchListing.mockResolvedValue({ ...gym, id: 4, name: 'Other Gym' });
    rerender(inRouter(<DetailPage slug="other-gym" />));
    await screen.findByText('Other Gym');
  });
});

describe('DetailPage favourite button', () => {
  it('shows a pressed heart and calls onToggleFavourite', async () => {
    const onToggle = vi.fn();
    show({ favourites: [3], onToggleFavourite: onToggle });
    const btn = await screen.findByRole('button', { name: /save baobab barbell/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    // The page knows the gym's id once it has loaded, and passes it up.
    expect(onToggle).toHaveBeenCalledWith(3);
  });
});

describe('DetailPage gallery', () => {
  it('starts on the photo the card showed, then the gym\'s other photos', async () => {
    show();
    await screen.findByText('Baobab Barbell');
    // Card photo is strength (most popular tag), so it goes first.
    expect(document.querySelector('.gallery-main').getAttribute('src')).toMatch(/strength\.webp$/);
    const buttons = await screen.findAllByRole('button', { name: /show photo/i });
    expect(buttons).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Show photo 2 of 3' }));
    expect(document.querySelector('.gallery-main').getAttribute('src')).toMatch(/boxing\.webp$/);
  });
});

describe('DetailPage similar gyms', () => {
  it('lists the similar gyms as cards that link to their pages', async () => {
    show();
    const section = await screen.findByRole('region', { name: /similar gyms/i });
    const link = await within(section).findByRole('link', { name: 'Iron House' });
    expect(link.getAttribute('href')).toBe('/listing/iron-house');
    expect(within(section).getByRole('link', { name: 'Jab Club' })).toBeTruthy();
    expect(fetchSimilarListings.mock.calls[0][0]).toBe('baobab-barbell');
  });

  it('a similar gym link keeps the search the visitor started from', async () => {
    // A real route, so clicking the link opens the next gym's page.
    const BySlug = () => <DetailPage slug={useParams().slug} />;
    render(
      <MemoryRouter initialEntries={[{ pathname: '/listing/baobab-barbell', state: { from: '/?q=box&page=2' } }]}>
        <Routes>
          <Route path="/listing/:slug" element={<BySlug />} />
        </Routes>
      </MemoryRouter>,
    );
    const section = await screen.findByRole('region', { name: /similar gyms/i });
    fetchListing.mockResolvedValue({ ...similar[0] });
    fireEvent.click(await within(section).findByRole('link', { name: 'Iron House' }));
    await screen.findByRole('heading', { level: 1, name: 'Iron House' });
    expect(screen.getByRole('link', { name: /back to search/i }).getAttribute('href')).toBe('/?q=box&page=2');
  });

  it('hides the section when there are no similar gyms', async () => {
    fetchSimilarListings.mockResolvedValue([]);
    show();
    await screen.findByText('Baobab Barbell');
    await waitFor(() => expect(fetchSimilarListings).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: /similar gyms/i })).toBeNull();
  });

  it('a failed similar list does not break the page, and Try again loads it', async () => {
    fetchSimilarListings.mockRejectedValueOnce(new Error('Could not load similar gyms.'));
    show();
    await screen.findByRole('heading', { level: 1, name: 'Baobab Barbell' });
    const section = await screen.findByRole('region', { name: /similar gyms/i });
    await within(section).findByText('Could not load similar gyms.');
    fireEvent.click(within(section).getByRole('button', { name: /try again/i }));
    await within(section).findByRole('link', { name: 'Iron House' });
  });

  it('the heart on a similar gym saves that gym', async () => {
    const onToggle = vi.fn();
    show({ favourites: [], onToggleFavourite: onToggle });
    await screen.findByRole('link', { name: 'Iron House' });
    fireEvent.click(screen.getByRole('button', { name: /save iron house/i }));
    expect(onToggle).toHaveBeenCalledWith(7);
  });
});

describe('DetailPage enquiry form', () => {
  it('has the enquiry form for this gym', async () => {
    show();
    await screen.findByRole('heading', { name: /ask baobab barbell/i });
    expect(screen.getByLabelText(/your name/i)).toBeTruthy();
  });
});
describe('DetailPage loading skeleton', () => {
  it('shows a placeholder block, with one "Loading gym" message for screen readers', () => {
    fetchListing.mockReturnValue(new Promise(() => {}));
    show();
    expect(document.querySelector('.detail-skeleton')).not.toBeNull();
    expect(document.querySelector('.detail-skeleton').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getAllByRole('status').filter((el) => /loading gym/i.test(el.textContent))).toHaveLength(1);
  });
});
