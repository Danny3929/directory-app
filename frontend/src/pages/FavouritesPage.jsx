import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { fetchListings } from '../api/listings.js';
import { gymImage, tagCounts } from '../lib/gymImage.js';
import GymCard from '../components/GymCard.jsx';

// The gyms the visitor saved with the heart. Saved ids live in localStorage
// (see lib/favourites.js); this page fetches the gyms and shows the saved ones.
export default function FavouritesPage({ favourites = [], onToggleFavourite }) {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState({ status: 'loading', listings: [], error: '' });

  useEffect(() => {
    let cancelled = false;
    fetchListings()
      .then((listings) => !cancelled && setData({ status: 'ready', listings, error: '' }))
      .catch((err) => !cancelled && setData({ status: 'error', listings: [], error: err.message }));
    // If the page is left or retried, ignore the old answer when it arrives.
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setData((old) => ({ ...old, status: 'loading' }));
    setAttempt((n) => n + 1);
  };

  const counts = useMemo(() => tagCounts(data.listings), [data.listings]);
  // A to Z by name, like ties on the search page.
  const saved = data.listings
    .filter((g) => favourites.includes(g.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  // Saved ids the server no longer knows about (gym removed), so they can be cleared.
  const goneIds = data.status === 'ready' ? favourites.filter((id) => !data.listings.some((g) => g.id === id)) : [];

  return (
    <main className="page">
      <title>Saved gyms | Nairobi gyms</title>
      <h1>Saved gyms</h1>

      {data.status === 'loading' && (
        <p role="status" className="muted">
          Loading saved gyms…
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

      {data.status === 'ready' && favourites.length === 0 && (
        <div className="notice">
          <p>You have no saved gyms yet. Tap the heart on a gym to save it.</p>
          <Link to="/">Find a gym</Link>
        </div>
      )}

      {data.status === 'ready' && favourites.length > 0 && (
        <>
          <p className="muted" aria-live="polite">
            {saved.length} saved {saved.length === 1 ? 'gym' : 'gyms'}
          </p>
          <ul className="gym-grid">
            {saved.map((gym) => (
              <GymCard
                key={gym.id}
                gym={gym}
                image={gymImage(gym, { query: '', counts })}
                isFavourite
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
        </>
      )}
    </main>
  );
}
