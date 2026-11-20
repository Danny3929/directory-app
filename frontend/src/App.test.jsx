// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import App from './App.jsx';
import { useAuth } from './AuthContext.jsx';
import { fetchListings, fetchZips, fetchListing } from './api/listings.js';

// App only needs to know who is logged in; each test sets what useAuth returns.
vi.mock('./AuthContext.jsx', () => ({ useAuth: vi.fn() }));

vi.mock('./api/listings.js', () => ({
  fetchListings: vi.fn(),
  fetchZips: vi.fn(),
  fetchListing: vi.fn(),
  fetchTagCounts: vi.fn(async () => ({})),
  fetchSimilarListings: vi.fn(async () => []),
}));

const gym = (id, name) => ({
  id, name, slug: name.toLowerCase().replace(/ /g, '-'), description: `${name} description`, tags: ['classes'],
  address: '1 Test Rd', area: 'Kilimani', city: 'Nairobi', priceMin: 3000, priceMax: 4000,
  isFeatured: false, lat: -1.29, lng: 36.78,
});
const gyms = [gym(1, 'Alpha Gym'), gym(2, 'Beta Gym')];

// The real browser router, so the address bar (window.location) is what we check.
const openAt = (url) => {
  window.history.replaceState(null, '', url);
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );
};

beforeEach(() => {
  localStorage.clear();
  useAuth.mockReset().mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() });
  fetchListings.mockReset().mockResolvedValue(structuredClone(gyms));
  fetchZips.mockReset().mockResolvedValue([]);
  fetchListing.mockReset().mockImplementation(async (slug) => structuredClone(gyms.find((g) => g.slug === slug) ?? null));
});
afterEach(cleanup);

describe('App routing', () => {
  it('card names link to /listing/<slug>', async () => {
    openAt('/');
    const link = await screen.findByRole('link', { name: 'Beta Gym' });
    expect(link.getAttribute('href')).toBe('/listing/beta-gym');
  });

  it('a shared /listing/<slug> link opens that gym straight away', async () => {
    openAt('/listing/beta-gym');
    await screen.findByRole('heading', { level: 1, name: 'Beta Gym' });
    expect(fetchListing).toHaveBeenCalledWith('beta-gym');
  });

  it('opening a gym and pressing Back to search brings the same search back', async () => {
    openAt('/?q=gym');
    fireEvent.click(await screen.findByRole('link', { name: 'Beta Gym' }));
    await screen.findByRole('heading', { level: 1, name: 'Beta Gym' });
    expect(window.location.pathname).toBe('/listing/beta-gym');
    // The detail address stays clean: the search is remembered, not copied into it.
    expect(window.location.search).toBe('');

    fireEvent.click(screen.getByRole('link', { name: /back to search/i }));
    await screen.findByRole('link', { name: 'Alpha Gym' });
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('?q=gym');
    expect(screen.getByLabelText('Search gyms').value).toBe('gym');
  });

  it('shows a not-found page with a way back for an unknown address', async () => {
    openAt('/nonsense');
    // A main heading, so screen-reader users jumping by headings hear what page this is.
    expect(screen.getByRole('heading', { level: 1, name: /page not found/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to search/i }).getAttribute('href')).toBe('/');
  });

  // The browser tab (and a screen reader, on each new page) says which page you are on.
  it.each([
    ['/', 'Find a gym in Nairobi'],
    ['/favourites', 'Saved gyms | Nairobi gyms'],
    ['/listing/beta-gym', 'Beta Gym | Nairobi gyms'],
    ['/listing/no-such-gym', 'Gym not found | Nairobi gyms'],
    ['/nonsense', 'Page not found | Nairobi gyms'],
  ])('the tab title for %s is "%s"', async (url, title) => {
    openAt(url);
    await vi.waitFor(() => expect(document.title).toBe(title));
  });

  it('"Find a gym" in the menu starts a fresh search, even from a search', async () => {
    openAt('/?q=alpha');
    await screen.findByRole('link', { name: 'Alpha Gym' });
    expect(screen.queryByRole('link', { name: 'Beta Gym' })).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    fireEvent.click(within(nav).getByRole('link', { name: /find a gym/i }));
    await screen.findByRole('link', { name: 'Beta Gym' });
    expect(screen.getByLabelText('Search gyms').value).toBe('');
    expect(window.location.search).toBe('');
  });

  it('the top menu marks the page you are on', async () => {
    openAt('/favourites');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: /saved gyms/i }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: /find a gym/i }).getAttribute('aria-current')).toBeNull();
  });
});

describe('App favourites', () => {
  it('saves a favourite from a card and remembers it after a reload', async () => {
    const { unmount } = openAt('/');
    const heart = await screen.findByRole('button', { name: 'Save Alpha Gym' });
    expect(heart.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(heart);
    expect(screen.getByRole('button', { name: 'Save Alpha Gym' }).getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('gym-favourites'))).toEqual([1]);
    unmount();
    openAt('/');
    expect((await screen.findByRole('button', { name: 'Save Alpha Gym' })).getAttribute('aria-pressed')).toBe('true');
  });

  it('the detail page heart shares the same saved list', async () => {
    openAt('/listing/beta-gym');
    fireEvent.click(await screen.findByRole('button', { name: 'Save Beta Gym' }));
    expect(JSON.parse(localStorage.getItem('gym-favourites'))).toEqual([2]);
  });

  it('the detail page heart starts pressed for a saved gym', async () => {
    localStorage.setItem('gym-favourites', '[2]');
    openAt('/listing/beta-gym');
    const heart = await screen.findByRole('button', { name: 'Save Beta Gym' });
    expect(heart.getAttribute('aria-pressed')).toBe('true');
  });

  it('the menu shows how many gyms are saved', async () => {
    localStorage.setItem('gym-favourites', '[1,2]');
    openAt('/');
    expect(screen.getByRole('link', { name: 'Saved gyms (2)' })).toBeTruthy();
  });

  it('the saved gyms page lists only saved gyms, and Back from a gym returns there', async () => {
    localStorage.setItem('gym-favourites', '[2]');
    openAt('/favourites');
    await screen.findByRole('heading', { level: 1, name: 'Saved gyms' });
    const beta = await screen.findByRole('link', { name: 'Beta Gym' });
    expect(screen.queryByRole('link', { name: 'Alpha Gym' })).toBeNull();
    fireEvent.click(beta);
    await screen.findByRole('heading', { level: 1, name: 'Beta Gym' });

    fireEvent.click(screen.getByRole('link', { name: /back to saved gyms/i }));
    await screen.findByRole('heading', { level: 1, name: 'Saved gyms' });
    expect(window.location.pathname).toBe('/favourites');
  });

  it('un-saving a gym on the saved gyms page takes it off the list', async () => {
    localStorage.setItem('gym-favourites', '[1,2]');
    openAt('/favourites');
    fireEvent.click(await screen.findByRole('button', { name: 'Save Alpha Gym' }));
    expect(screen.queryByRole('link', { name: 'Alpha Gym' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Beta Gym' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('gym-favourites'))).toEqual([2]);
  });
});

describe('account links in the nav', () => {
  const nav = () => within(screen.getByRole('navigation', { name: 'Main' }));

  it('logged out: Log in and Register, no Log out', () => {
    openAt('/');
    expect(nav().getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
    expect(nav().getByRole('link', { name: 'Register' })).toBeTruthy();
    expect(nav().queryByRole('button', { name: 'Log out' })).toBeNull();
  });

  it('still checking who is logged in: neither set is shown', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    openAt('/');
    expect(nav().queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(nav().queryByRole('button', { name: 'Log out' })).toBeNull();
  });

  it('logged in: shows the email and Log out, which logs out and goes home', async () => {
    const logout = vi.fn().mockResolvedValue();
    useAuth.mockReturnValue({ user: { email: 'o@x.co', role: 'owner' }, loading: false, logout });
    openAt('/favourites');
    expect(nav().getByText('o@x.co')).toBeTruthy();
    expect(nav().queryByRole('link', { name: 'Log in' })).toBeNull();
    fireEvent.click(nav().getByRole('button', { name: 'Log out' }));
    await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(logout).toHaveBeenCalled();
  });
});
