import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchListings, fetchZips } from '../api/listings.js';
import { filterByText, filterByRadius, filterByTags, filterByPrice, sortByDistance, sortByCheapest, sortByFeatured } from '../lib/search.js';
import { parseSearch, buildSearch, RADII } from '../lib/urlState.js';
import { gymImage, tagCounts } from '../lib/gymImage.js';
import { tagLabel } from '../lib/tags.js';
import { isOverBudget, priceRangeError, priceText } from '../lib/price.js';
import GymCard from '../components/GymCard.jsx';

const ZIP_LENGTH = 5;
const PRICE_DIGITS = 6;
const SEARCH_DELAY_MS = 300;
// Load more shows this many more gyms each time (the guide asks for 12 per page).
const PAGE_SIZE = 12;

// What the visitor typed in a price box -> a number, or null for empty.
// Anything that is not a digit (letters, commas, spaces) is dropped, so '4,000' is 4000.
const toPrice = (text) => {
  const digits = text.replace(/\D/g, '').slice(0, PRICE_DIGITS);
  return digits === '' ? null : Number(digits);
};

export default function SearchPage({ favourites = [], onToggleFavourite }) {
  // The search choices live in the address bar too, so links can be shared.
  const [filters, setFilters] = useState(() => parseSearch(window.location.search));
  // Demo switch: opening the page with ?fail=1 makes the first load fail,
  // so the error state can be shown. "Try again" then works.
  const [demoFail] = useState(() => new URLSearchParams(window.location.search).get('fail') === '1');
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState({ status: 'loading', listings: [], zips: [], error: '' });

  useEffect(() => {
    let cancelled = false;
    const fail = demoFail && attempt === 0;
    Promise.all([fetchListings({ fail }), fetchZips()])
      .then(([listings, zips]) => {
        if (!cancelled) setData({ status: 'ready', listings, zips, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setData({ status: 'error', listings: [], zips: [], error: err.message });
      });
    // If the page is left or retried, ignore the old answer when it arrives.
    return () => {
      cancelled = true;
    };
  }, [attempt, demoFail]);

  // replaceState rewrites the address without adding a Back-button step per keystroke.
  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname + buildSearch(filters));
  }, [filters]);

  const retry = () => {
    setData((old) => ({ ...old, status: 'loading' }));
    setAttempt((n) => n + 1);
  };

  // Dan's spec: any new search choice is a new search, so it goes back to the first 12.
  // Only Load more passes a page of its own.
  const update = (change) => setFilters((old) => ({ ...old, page: 1, ...change }));

  // Debounce (Dan's spec): the box shows each letter at once (text), but the list
  // and address (filters.q) only change after SEARCH_DELAY_MS with no new letter.
  const [text, setText] = useState(filters.q);
  useEffect(() => {
    // Every new letter cancels the old timer (cleanup below) and starts a new one.
    const timer = setTimeout(() => {
      setFilters((old) => (old.q === text ? old : { ...old, q: text, page: 1 }));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);
  // Enter and "Clear search" skip the wait.
  const searchNow = (value) => {
    setText(value);
    update({ q: value });
  };

  const zipCode = filters.zip.trim();
  const origin = data.zips.find((z) => z.zip === zipCode) ?? null;
  const zipIncomplete = zipCode !== '' && !origin && zipCode.length < ZIP_LENGTH;
  const zipUnknown = zipCode !== '' && !origin && !zipIncomplete;
  const needsOrigin = filters.sort === 'distance' && !origin;
  // The radius is kept in the address even without a ZIP, but only used once we know where "you" are.
  const radiusOn = Boolean(origin && filters.radius);

  // Saved ids the server no longer knows about (gym removed). Shown so they can be cleared.
  const goneIds = filters.saved && filters.q === ''
    ? favourites.filter((id) => !data.listings.some((g) => g.id === id))
    : [];

  // How many gyms have each tag: the chip counts and the "most popular tag" photo rule.
  const counts = useMemo(() => tagCounts(data.listings), [data.listings]);
  const allTags = Object.keys(counts).sort();
  // A tag in a shared link that no gym has is ignored, like ?radius=7.
  const activeTags = useMemo(() => filters.tags.filter((t) => counts[t]), [filters.tags, counts]);
  const toggleTag = (tag) =>
    update({ tags: activeTags.includes(tag) ? activeTags.filter((t) => t !== tag) : [...activeTags, tag] });

  // Min more than Max: say so and leave the price filter off (Dan's spec).
  const priceError = priceRangeError(filters.min, filters.max);
  const priceOn = !priceError && (filters.min != null || filters.max != null);
  const budget = priceError ? null : filters.max;

  const results = useMemo(() => {
    const pool = filters.saved ? data.listings.filter((g) => favourites.includes(g.id)) : data.listings;
    const matched = filterByPrice(
      filterByTags(filterByRadius(filterByText(pool, filters.q), origin, filters.radius), activeTags),
      filters.min,
      filters.max,
    );
    // Always run the distance sort first: it adds distanceKm to each gym when
    // we know the ZIP, and gives the A to Z tie order the other sorts keep.
    const byDistance = sortByDistance(matched, origin);
    if (filters.sort === 'cheapest') return sortByCheapest(byDistance);
    if (filters.sort === 'featured') return sortByFeatured(byDistance);
    return byDistance;
  }, [data.listings, filters.q, filters.sort, filters.saved, filters.radius, filters.min, filters.max, activeTags, favourites, origin]);

  // Only the first page * 12 gyms are drawn; Load more raises the page by one.
  const shown = results.slice(0, filters.page * PAGE_SIZE);
  const hasMore = shown.length < results.length;

  // After Load more, move keyboard focus to the first new gym, so keyboard and
  // screen-reader users carry on from there instead of being left on a button.
  const gridRef = useRef(null);
  const focusFrom = useRef(null);
  useEffect(() => {
    if (focusFrom.current == null) return;
    const links = gridRef.current?.querySelectorAll('h3 a');
    links?.[focusFrom.current]?.focus();
    focusFrom.current = null;
  }, [shown.length]);
  const loadMore = () => {
    focusFrom.current = shown.length;
    update({ page: filters.page + 1 });
  };

  return (
    <main className="page">
      <header className="hero">
        {/* Decorative: the headline says it all, so the photo has empty alt text. */}
        <img className="hero-photo" src={`${import.meta.env.BASE_URL}images/hero.webp`} alt="" width="1600" height="640" fetchPriority="high" />
        <div className="hero-text">
          <h1>Find a gym in Nairobi</h1>
          <p>Weights, classes, boxing and more, near you.</p>
        </div>
      </header>

      <form
        className="controls"
        onSubmit={(e) => {
          e.preventDefault();
          searchNow(text);
        }}
      >
        <div className="field">
          <label htmlFor="q">Search gyms</label>
          <input
            id="q"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Name or what they offer"
          />
        </div>
        <div className="field">
          <label htmlFor="zip">Your ZIP code</label>
          <input
            id="zip"
            type="text"
            inputMode="numeric"
            maxLength={ZIP_LENGTH}
            value={filters.zip}
            onChange={(e) => update({ zip: e.target.value })}
            placeholder="e.g. 00619"
          />
        </div>
        <div className="field">
          <label htmlFor="radius">Within</label>
          <select
            id="radius"
            value={origin ? (filters.radius ?? '') : ''}
            disabled={!origin}
            aria-describedby={origin ? undefined : 'radius-hint'}
            onChange={(e) => update({ radius: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">Any distance</option>
            {RADII.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
          {!origin && (
            <p id="radius-hint" className="hint">
              {zipUnknown ? 'Pick a ZIP above to filter by distance' : 'Enter a ZIP to filter by distance'}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="featured">Featured first</option>
            <option value="cheapest">Cheapest first</option>
            <option value="distance">Nearest first</option>
          </select>
        </div>
        {/* Two plain number boxes. type="text" + inputMode="numeric" gives a number
            keypad on phones without the spinner arrows and odd values of type="number". */}
        <fieldset className="field-price">
          <legend>Price a month</legend>
          <div className="price-boxes">
            <div className="field">
              <label htmlFor="min">Min Ksh</label>
              <input
                id="min"
                type="text"
                inputMode="numeric"
                value={filters.min ?? ''}
                aria-invalid={priceError ? true : undefined}
                aria-describedby={priceError ? 'price-error' : undefined}
                onChange={(e) => update({ min: toPrice(e.target.value) })}
                placeholder="Any"
              />
            </div>
            <div className="field">
              <label htmlFor="max">Max Ksh</label>
              <input
                id="max"
                type="text"
                inputMode="numeric"
                value={filters.max ?? ''}
                aria-invalid={priceError ? true : undefined}
                aria-describedby={priceError ? 'price-error' : undefined}
                onChange={(e) => update({ max: toPrice(e.target.value) })}
                placeholder="Any"
              />
            </div>
          </div>
          {priceError && (
            <p id="price-error" className="hint hint-error" role="alert">
              {priceError}
            </p>
          )}
        </fieldset>
        <div className="field field-check">
          <input
            id="saved"
            type="checkbox"
            checked={filters.saved}
            onChange={(e) => update({ saved: e.target.checked })}
          />
          <label htmlFor="saved">Saved only</label>
        </div>
        {allTags.length > 0 && (
          // Toggle buttons: aria-pressed tells screen readers "pressed" or "not pressed".
          <fieldset className="field-tags">
            <legend>Tags (gyms must have all you pick)</legend>
            <ul className="tag-chips">
              {allTags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={activeTags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    {tagLabel(tag)} ({counts[tag]})
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </form>

      {data.status === 'ready' && zipIncomplete && (
        <p className="muted">ZIP codes have 5 digits.</p>
      )}

      {data.status === 'ready' && zipUnknown && (
        <div className="notice notice-warn" role="status">
          <p>We don't recognise ZIP {zipCode}. Did you mean one of these?</p>
          <ul className="zip-list">
            {data.zips.map((z) => (
              <li key={z.zip}>
                <button type="button" onClick={() => update({ zip: z.zip })}>
                  {z.zip} {z.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.status === 'ready' && needsOrigin && (
        <p className="muted">
          Not sorted by distance. {zipCode === '' ? 'Enter your ZIP code to sort by distance.' : 'Pick a ZIP code above.'}
        </p>
      )}

      {data.status === 'loading' && (
        <p role="status" className="muted">
          Loading gyms…
        </p>
      )}

      {data.status === 'error' && (
        <div className="notice notice-error" role="alert">
          <p>{data.error}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {data.status === 'ready' && filters.saved && favourites.length === 0 && (
        <div className="notice">
          <p>You have no saved gyms yet. Tap the heart on a gym to save it.</p>
          <button type="button" onClick={() => update({ saved: false })}>
            Show all gyms
          </button>
        </div>
      )}

      {data.status === 'ready' && results.length === 0 && goneIds.length === 0 && !(filters.saved && favourites.length === 0) && (
        <div className="notice">
          {radiusOn ? (
            <>
              <p>
                No gyms within {filters.radius} km of {zipCode}
                {filters.q ? ` match "${filters.q}"` : ''}.
              </p>
              <button type="button" onClick={() => update({ radius: null })}>
                Show any distance
              </button>
            </>
          ) : activeTags.length > 0 ? (
            <>
              <p>
                No gyms have all of: {activeTags.map(tagLabel).join(', ')}
                {filters.q ? ` and match "${filters.q}"` : ''}.
              </p>
              <button type="button" onClick={() => update({ tags: [] })}>
                Clear tags
              </button>
            </>
          ) : priceOn ? (
            <>
              <p>
                No gyms have a plan {priceText(filters.min, filters.max)}
                {filters.q ? ` and match "${filters.q}"` : ''}.
              </p>
              <button type="button" onClick={() => update({ min: null, max: null })}>
                Clear price
              </button>
            </>
          ) : (
            <>
              <p>No gyms match "{filters.q}".</p>
              <button type="button" onClick={() => searchNow('')}>
                Clear search
              </button>
            </>
          )}
        </div>
      )}

      {data.status === 'ready' && (results.length > 0 || goneIds.length > 0) && (
        <>
          <p className="muted" aria-live="polite">
            {hasMore ? `Showing ${shown.length} of ${results.length} gyms` : `${results.length} ${results.length === 1 ? 'gym' : 'gyms'}`}
          </p>
          <ul className="gym-grid" ref={gridRef}>
            {shown.map((gym) => (
              <GymCard
                key={gym.id}
                gym={gym}
                image={gymImage(gym, { query: filters.q, counts })}
                overBudget={isOverBudget(gym, budget) ? budget : null}
                isFavourite={favourites.includes(gym.id)}
                onToggleFavourite={onToggleFavourite && (() => onToggleFavourite(gym.id))}
              />
            ))}
            {goneIds.map((id) => (
              <li key={`gone-${id}`} className="card">
                <p>This saved gym is no longer available.</p>
                <button type="button" onClick={() => onToggleFavourite?.(id)}>
                  Remove from saved
                </button>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="load-more">
              <button type="button" onClick={loadMore}>
                Load more gyms
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
