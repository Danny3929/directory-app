import { useEffect, useMemo, useState } from 'react';
import { fetchListings, fetchZips } from '../api/listings.js';
import { filterByText, sortByDistance, sortByCheapest, sortByFeatured } from '../lib/search.js';
import { parseSearch, buildSearch } from '../lib/urlState.js';
import GymCard from '../components/GymCard.jsx';

const ZIP_LENGTH = 5;

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

  const update = (change) => setFilters((old) => ({ ...old, ...change }));

  const zipCode = filters.zip.trim();
  const origin = data.zips.find((z) => z.zip === zipCode) ?? null;
  const zipIncomplete = zipCode !== '' && !origin && zipCode.length < ZIP_LENGTH;
  const zipUnknown = zipCode !== '' && !origin && !zipIncomplete;
  const needsOrigin = filters.sort === 'distance' && !origin;

  const results = useMemo(() => {
    const matched = filterByText(data.listings, filters.q);
    // Always run the distance sort first: it adds distanceKm to each gym when
    // we know the ZIP, and gives the A to Z tie order the other sorts keep.
    const byDistance = sortByDistance(matched, origin);
    if (filters.sort === 'cheapest') return sortByCheapest(byDistance);
    if (filters.sort === 'featured') return sortByFeatured(byDistance);
    return byDistance;
  }, [data.listings, filters.q, filters.sort, origin]);

  return (
    <main className="page">
      <h1>Find a gym in Nairobi</h1>

      <form className="controls" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="q">Search gyms</label>
          <input
            id="q"
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
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
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="featured">Featured first</option>
            <option value="cheapest">Cheapest first</option>
            <option value="distance">Nearest first</option>
          </select>
        </div>
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

      {data.status === 'ready' && results.length === 0 && (
        <div className="notice">
          <p>No gyms match "{filters.q}".</p>
          <button type="button" onClick={() => update({ q: '' })}>
            Clear search
          </button>
        </div>
      )}

      {data.status === 'ready' && results.length > 0 && (
        <>
          <p className="muted" aria-live="polite">
            {results.length} {results.length === 1 ? 'gym' : 'gyms'}
          </p>
          <ul className="gym-grid">
            {results.map((gym) => (
              <GymCard
                key={gym.id}
                gym={gym}
                isFavourite={favourites.includes(gym.id)}
                onToggleFavourite={onToggleFavourite && (() => onToggleFavourite(gym.id))}
              />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
