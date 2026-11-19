// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import SearchPage from './SearchPage.jsx';
import { fetchListings, fetchZips } from '../api/listings.js';

// The page must get its data through src/api/, so we replace that module
// with instant fakes. No timers, no real data.
vi.mock('../api/listings.js', () => ({
  fetchListings: vi.fn(),
  fetchZips: vi.fn(),
}));

const gym = (id, name, lat, lng, priceKsh, featured = false) => ({
  id, name, slug: name.toLowerCase().replace(/ /g, '-'), description: `${name} description`, tags: ['classes'],
  address: '1 Test Rd', area: 'Kilimani', city: 'Nairobi', priceMin: priceKsh, priceMax: priceKsh, isFeatured: featured, lat, lng,
});

// The real browser router, so the tests can keep checking window.location.
const show = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

const gyms = [
  gym(1, 'Alpha Gym', -1.29, 36.78, 3000),
  gym(2, 'Beta Gym', -1.3, 36.8, 2000, true),
  gym(3, 'Gamma Boxing', -1.28, 36.77, 2500),
];
const zips = [
  { zip: '00619', label: 'Kilimani', lat: -1.29, lng: 36.785 },
  { zip: '00100', label: 'Nairobi CBD', lat: -1.2864, lng: 36.8172 },
];

const names = () => screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
// Type in the search box, then press Enter, which searches at once (no 0.3 s wait).
const searchNow = (value) => {
  type(/search gyms/i, value);
  fireEvent.submit(screen.getByLabelText(/search gyms/i).closest('form'));
};
// Move the fake clock forward, inside act() so React redraws.
const wait = (ms) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  fetchListings.mockReset().mockResolvedValue(structuredClone(gyms));
  fetchZips.mockReset().mockResolvedValue(structuredClone(zips));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SearchPage search box waits for a pause (debounce, Dan picked 0.3 s)', () => {
  // Data loads with the real clock; only then do we take over the clock.
  const ready = async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    vi.useFakeTimers();
  };

  it('shows the letters at once, but only filters after 300 ms with no typing', async () => {
    await ready();
    type(/search gyms/i, 'box');
    expect(screen.getByLabelText(/search gyms/i).value).toBe('box');
    wait(299);
    expect(names()).toHaveLength(3);
    expect(window.location.search).toBe('');
    wait(1);
    expect(names()).toEqual(['Gamma Boxing']);
    expect(window.location.search).toBe('?q=box');
  });

  it('starts the wait again on every new letter', async () => {
    await ready();
    type(/search gyms/i, 'b');
    wait(200);
    type(/search gyms/i, 'bo');
    wait(200);
    type(/search gyms/i, 'box');
    wait(200);
    // 600 ms since the first letter, but never a 300 ms pause, so nothing filtered yet.
    expect(names()).toHaveLength(3);
    wait(100);
    expect(names()).toEqual(['Gamma Boxing']);
  });

  it('searches straight away when Enter is pressed', async () => {
    await ready();
    searchNow('box');
    expect(names()).toEqual(['Gamma Boxing']);
  });

  it('a pending search does not undo Clear search', async () => {
    await ready();
    searchNow('zzz');
    type(/search gyms/i, 'zzzz');
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    wait(300);
    expect(names()).toHaveLength(3);
    expect(screen.getByLabelText(/search gyms/i).value).toBe('');
  });
});

describe('SearchPage photos', () => {
  it('has a top band with the headline; its photo is decorative (empty alt)', async () => {
    const { container } = show(<SearchPage />);
    expect(screen.getByRole('heading', { level: 1, name: /find a gym in nairobi/i })).toBeTruthy();
    expect(container.querySelector('.hero-photo').getAttribute('alt')).toBe('');
    await screen.findByText('Alpha Gym');
  });

  it('puts a lazy-loaded photo with alt text on every card', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    const photos = screen.getAllByRole('img', { name: /fitness class/i });
    expect(photos).toHaveLength(3);
    expect(photos[0].getAttribute('loading')).toBe('lazy');
  });

  it('shows each gym photoTag photo, and a search does not change it', async () => {
    fetchListings.mockResolvedValue([gyms[0], { ...gyms[2], tags: ['classes', 'boxing'], photoTag: 'boxing' }]);
    show(<SearchPage />);
    await screen.findByText('Gamma Boxing');
    expect(screen.getAllByRole('img', { name: /fitness class/i })).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: /sparring/i })).toHaveLength(1);
    searchNow('Gamma');
    expect(screen.getAllByRole('img', { name: /sparring/i })).toHaveLength(1);
  });
});

describe('SearchPage', () => {
  it('shows a loading message, then the gyms', async () => {
    show(<SearchPage />);
    expect(screen.getByText(/loading gyms/i)).toBeTruthy();
    await screen.findByText('Alpha Gym');
    expect(screen.queryByText(/loading gyms/i)).toBeNull();
    expect(names()).toHaveLength(3);
  });

  it('filters by text and writes the search into the address', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    searchNow('box');
    expect(names()).toEqual(['Gamma Boxing']);
    expect(window.location.search).toBe('?q=box');
  });

  it('opens a shared link with the same search', async () => {
    window.history.replaceState(null, '', '/?q=gym&sort=cheapest');
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(screen.getByLabelText(/search gyms/i).value).toBe('gym');
    expect(names()).toEqual(['Beta Gym', 'Alpha Gym']);
  });

  it('shows an empty state with a way back', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    searchNow('zzz');
    expect(screen.getByText(/no gyms match/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(names()).toHaveLength(3);
    // The box empties too, so it does not still say "zzz".
    expect(screen.getByLabelText(/search gyms/i).value).toBe('');
  });

  it('shows an error with Try again, and recovers', async () => {
    fetchListings.mockRejectedValueOnce(new Error('Could not load gyms. Please try again.'));
    show(<SearchPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not load gyms');
    expect(names()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByText('Alpha Gym');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says an unknown ZIP is not recognised and lets the user pick one', async () => {
    window.history.replaceState(null, '', '/?sort=distance');
    show(<SearchPage />);
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
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    type(/your zip/i, '006');
    expect(screen.queryByText(/we don't recognise/i)).toBeNull();
    expect(screen.getByText(/5 digits/i)).toBeTruthy();
  });
});

describe('SearchPage without the Saved only box (Dan 2026-11-15: use the Saved gyms page)', () => {
  it('has no Saved only box, and an old ?saved=1 link shows all gyms', async () => {
    window.history.replaceState(null, '', '/?saved=1');
    show(<SearchPage favourites={[2]} onToggleFavourite={() => {}} />);
    await screen.findByText('Alpha Gym');
    expect(screen.queryByRole('checkbox', { name: /saved only/i })).toBeNull();
    expect(names()).toHaveLength(3);
    expect(window.location.search).toBe('');
  });
});

describe('SearchPage radius filter (Dan spec 2026-11-15)', () => {
  // Delta is about 17 km from ZIP 00619; the other three are within about 2 km.
  const withFar = () => [...structuredClone(gyms), gym(4, 'Delta Gym', -1.2, 36.9, 1500)];
  const radius = () => screen.getByLabelText(/within/i);

  it('starts on Any distance, disabled until a ZIP is known, with a hint', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(radius().value).toBe('');
    expect(radius().disabled).toBe(true);
    expect(screen.getByText(/enter a zip to filter by distance/i)).toBeTruthy();
    expect(window.location.search).toBe('');
  });

  it('filters by distance once a ZIP is entered and writes ?radius= into the address', async () => {
    fetchListings.mockResolvedValue(withFar());
    show(<SearchPage />);
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
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(radius().value).toBe('10');
    expect(names()).not.toContain('Delta Gym');
  });

  it('treats an unknown ZIP like no ZIP: radius off, all gyms, Did you mean list stays', async () => {
    fetchListings.mockResolvedValue(withFar());
    window.history.replaceState(null, '', '/?zip=99999&radius=5');
    show(<SearchPage />);
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
    show(<SearchPage />);
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

describe('SearchPage tag filters (Dan spec 2026-11-15: ALL picked tags, toggle chips)', () => {
  const tagged = () => [
    { ...gym(1, 'Alpha Gym', -1.29, 36.78, 3000), tags: ['boxing', 'strength'] },
    { ...gym(2, 'Beta Gym', -1.3, 36.8, 2000), tags: ['boxing'] },
    { ...gym(3, 'Gamma Yoga', -1.28, 36.77, 2500), tags: ['yoga'] },
  ];
  const chip = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`, 'i') });

  beforeEach(() => fetchListings.mockResolvedValue(tagged()));

  it('shows one chip per tag with how many gyms have it, none pressed', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(chip('boxing').textContent).toMatch(/Boxing\s*\(2\)/);
    expect(chip('strength').textContent).toMatch(/\(1\)/);
    expect(chip('yoga').getAttribute('aria-pressed')).toBe('false');
  });

  it('pressing a chip filters the list and writes ?tags=; pressing again undoes it', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    fireEvent.click(chip('boxing'));
    expect(chip('boxing').getAttribute('aria-pressed')).toBe('true');
    expect(names()).toEqual(expect.arrayContaining(['Alpha Gym', 'Beta Gym']));
    expect(names()).toHaveLength(2);
    expect(window.location.search).toBe('?tags=boxing');
    fireEvent.click(chip('boxing'));
    expect(names()).toHaveLength(3);
    expect(window.location.search).toBe('');
  });

  it('needs ALL pressed tags, and keeps them A to Z in the address', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    fireEvent.click(chip('strength'));
    fireEvent.click(chip('boxing'));
    expect(names()).toEqual(['Alpha Gym']);
    expect(window.location.search).toBe('?tags=boxing,strength');
  });

  it('opens a shared tags link with the same chips pressed', async () => {
    window.history.replaceState(null, '', '/?tags=boxing,strength');
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(chip('boxing').getAttribute('aria-pressed')).toBe('true');
    expect(chip('strength').getAttribute('aria-pressed')).toBe('true');
    expect(names()).toEqual(['Alpha Gym']);
  });

  it('says when no gym has all the tags and offers to clear them', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    fireEvent.click(chip('boxing'));
    fireEvent.click(chip('yoga'));
    expect(names()).toHaveLength(0);
    expect(screen.getByText(/no gyms have all of: boxing, yoga/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /clear tags/i }));
    expect(names()).toHaveLength(3);
    expect(window.location.search).toBe('');
  });

  it('ignores a tag in the link that no gym has, instead of showing nothing', async () => {
    window.history.replaceState(null, '', '/?tags=sauna');
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(names()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /^sauna/i })).toBeNull();
  });
});

describe('SearchPage price range (Dan spec 2026-11-15: Min and Max boxes, overlap, mark over-budget)', () => {
  const priced = () => [
    { ...gym(1, 'Alpha Gym', -1.29, 36.78, 0), priceMin: 1500, priceMax: 2500 },
    { ...gym(2, 'Beta Gym', -1.3, 36.8, 0), priceMin: 3000, priceMax: 5000 },
    { ...gym(3, 'Gamma Gym', -1.28, 36.77, 0), priceMin: 8000, priceMax: 11000 },
  ];
  beforeEach(() => fetchListings.mockResolvedValue(priced()));

  it('has labelled Min and Max boxes that start empty', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(screen.getByLabelText(/min ksh/i).value).toBe('');
    expect(screen.getByLabelText(/max ksh/i).value).toBe('');
  });

  it('a Max keeps gyms whose cheapest plan fits, marks them, and writes ?max=', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    type(/max ksh/i, '4000');
    expect(names()).toEqual(expect.arrayContaining(['Alpha Gym', 'Beta Gym']));
    expect(names()).toHaveLength(2);
    expect(window.location.search).toBe('?max=4000');
    // Beta (3,000 – 5,000) is shown but marked; Alpha (up to 2,500) is not.
    expect(screen.getAllByText(/some plans over ksh 4,000/i)).toHaveLength(1);
  });

  it('a Min keeps gyms whose dearest plan reaches it', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    type(/min ksh/i, '6000');
    expect(names()).toEqual(['Gamma Gym']);
    expect(window.location.search).toBe('?min=6000');
  });

  it('drops letters and commas as you type, so "4,000" means 4000', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    type(/max ksh/i, '4,0a00');
    expect(screen.getByLabelText(/max ksh/i).value).toBe('4000');
    expect(window.location.search).toBe('?max=4000');
  });

  it('opens a shared price link with the same boxes filled in', async () => {
    window.history.replaceState(null, '', '/?min=2000&max=6000');
    show(<SearchPage />);
    await screen.findByText('Beta Gym');
    expect(screen.getByLabelText(/min ksh/i).value).toBe('2000');
    expect(screen.getByLabelText(/max ksh/i).value).toBe('6000');
    expect(names()).toEqual(['Alpha Gym', 'Beta Gym']);
  });

  it('says when Min is more than Max and leaves the price filter off', async () => {
    window.history.replaceState(null, '', '/?min=6000&max=2000');
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(screen.getByText(/min is more than max/i)).toBeTruthy();
    expect(names()).toHaveLength(3);
    expect(screen.queryByText(/some plans over/i)).toBeNull();
  });

  it('says when no gym has a plan in the range and offers to clear it', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    type(/min ksh/i, '5500');
    type(/max ksh/i, '7500');
    expect(names()).toHaveLength(0);
    expect(screen.getByText(/no gyms have a plan between ksh 5,500 and 7,500/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /clear price/i }));
    expect(names()).toHaveLength(3);
    expect(window.location.search).toBe('');
  });
});

describe('SearchPage Load more (Dan spec 2026-11-15: 12 a time, a new search goes back to 12)', () => {
  // 30 gyms named Gym 01 to Gym 30, so the A to Z order is easy to check. The first 20 do boxing.
  const many = () =>
    Array.from({ length: 30 }, (_, i) => ({
      ...gym(i + 1, `Gym ${String(i + 1).padStart(2, '0')}`, -1.29, 36.78, 2000),
      tags: i < 20 ? ['boxing'] : ['yoga'],
    }));
  const loadMore = () => fireEvent.click(screen.getByRole('button', { name: /load more/i }));
  beforeEach(() => fetchListings.mockResolvedValue(many()));

  it('shows the first 12 and says how many there are in all', async () => {
    show(<SearchPage />);
    await screen.findByText('Gym 01');
    expect(names()).toHaveLength(12);
    expect(names()[11]).toBe('Gym 12');
    expect(screen.getByText('Showing 12 of 30 gyms')).toBeTruthy();
  });

  it('Load more adds the next 12, writes ?page=2 and moves focus to the first new gym', async () => {
    show(<SearchPage />);
    await screen.findByText('Gym 01');
    loadMore();
    expect(names()).toHaveLength(24);
    expect(window.location.search).toBe('?page=2');
    expect(document.activeElement.textContent).toBe('Gym 13');
  });

  it('hides Load more once every gym is showing', async () => {
    show(<SearchPage />);
    await screen.findByText('Gym 01');
    loadMore();
    loadMore();
    expect(names()).toHaveLength(30);
    expect(screen.getByText('30 gyms')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('Dan’s case: 36 showing, then tick Boxing, goes back to the first 12', async () => {
    window.history.replaceState(null, '', '/?page=3');
    show(<SearchPage />);
    await screen.findByText('Gym 01');
    expect(names()).toHaveLength(30);
    fireEvent.click(screen.getByRole('button', { name: /boxing/i }));
    expect(names()).toHaveLength(12);
    expect(screen.getByText('Showing 12 of 20 gyms')).toBeTruthy();
    expect(window.location.search).toBe('?tags=boxing');
  });

  it('a new search word also goes back to 12, after the 0.3 s pause', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.history.replaceState(null, '', '/?page=2');
    show(<SearchPage />);
    await screen.findByText('Gym 01');
    expect(names()).toHaveLength(24);
    type(/search gyms/i, 'gym');
    await wait(300);
    expect(names()).toHaveLength(12);
    expect(window.location.search).toBe('?q=gym');
  });

  it('a shared ?page=2 link opens with 24 gyms', async () => {
    window.history.replaceState(null, '', '/?page=2');
    show(<SearchPage />);
    await screen.findByText('Gym 01');
    expect(names()).toHaveLength(24);
    expect(screen.getByText('Showing 24 of 30 gyms')).toBeTruthy();
  });

  it('a bad ?page= value shows the first 12', async () => {
    window.history.replaceState(null, '', '/?page=abc');
    show(<SearchPage />);
    await screen.findByText('Gym 01');
    expect(names()).toHaveLength(12);
  });

  it('no Load more button when 12 or fewer gyms match', async () => {
    fetchListings.mockResolvedValue(structuredClone(gyms));
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });
});

describe('SearchPage loading skeletons', () => {
  const never = () => new Promise(() => {});

  it('shows 12 grey placeholder cards while gyms load, not the old text', () => {
    fetchListings.mockReturnValue(never());
    fetchZips.mockReturnValue(never());
    show(<SearchPage />);
    expect(document.querySelectorAll('.card-skeleton')).toHaveLength(12);
    // The words are still there for screen readers, but no longer shown on screen.
    expect(screen.getByText(/loading gyms…/i).className).toContain('visually-hidden');
  });

  it('screen readers get one "Loading gyms" message and the placeholders are hidden', () => {
    fetchListings.mockReturnValue(never());
    fetchZips.mockReturnValue(never());
    show(<SearchPage />);
    expect(screen.getAllByRole('status').filter((el) => /loading gyms/i.test(el.textContent))).toHaveLength(1);
    const grid = document.querySelector('.card-skeleton').closest('ul');
    expect(grid.getAttribute('aria-hidden')).toBe('true');
  });

  it('the placeholders go away when the gyms arrive', async () => {
    show(<SearchPage />);
    await screen.findByText('Alpha Gym');
    expect(document.querySelectorAll('.card-skeleton')).toHaveLength(0);
  });
});
