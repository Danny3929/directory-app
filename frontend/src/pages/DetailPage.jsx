import { useEffect, useState } from 'react';
import FavouriteButton from '../components/FavouriteButton.jsx';
import { fetchListing, fetchTagCounts } from '../api/listings.js';
import { gymImage } from '../lib/gymImage.js';
import { parseSearch } from '../lib/urlState.js';

// One gym in full. The page asks the fake API for it by id and shows one of:
// loading, error (with Try again), not found, or the gym.
export default function DetailPage({ gymId, isFavourite = false, onToggleFavourite }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', gym: null, error: '' });
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    // Only for the photo. If it fails the page still works: ties then go A to Z.
    fetchTagCounts()
      .then((c) => !cancelled && setCounts(c))
      .catch(() => {});
    fetchListing(gymId)
      .then((gym) => {
        if (!cancelled) setState({ status: gym ? 'ready' : 'notfound', gym, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', gym: null, error: err.message });
      });
    // Ignore an old answer if the id changed or the page was left.
    return () => {
      cancelled = true;
    };
  }, [gymId, attempt]);

  const retry = () => {
    setState({ status: 'loading', gym: null, error: '' });
    setAttempt((n) => n + 1);
  };

  const { status, gym, error } = state;
  // The search text is still in the address (?q=), so the photo matches the card.
  const image = gym && gymImage(gym, { query: parseSearch(window.location.search).q, counts });

  return (
    <main className="page">
      {/* "#/" keeps the ?q= ?zip= ?sort= part of the address, so the same search comes back. */}
      <a className="back-link" href="#/">
        ← Back to search
      </a>

      {status === 'loading' && <p role="status">Loading gym…</p>}

      {status === 'error' && (
        <div className="notice notice-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {status === 'notfound' && (
        <div className="notice">
          <p>We could not find that gym. It may have been removed.</p>
        </div>
      )}

      {status === 'ready' && (
        <article className="detail">
          <div className="card-top">
            <h1>{gym.name}</h1>
            {gym.featured && <span className="badge">Featured</span>}
            {onToggleFavourite && (
              <FavouriteButton gymName={gym.name} isFavourite={isFavourite} onToggle={onToggleFavourite} />
            )}
          </div>
          <img className="detail-photo" src={image.src} alt={image.alt} width="960" height="540" />
          <p className="muted">
            {gym.address}, {gym.area}, {gym.city}
          </p>
          <p className="card-facts">
            <span>Ksh {gym.priceKsh.toLocaleString('en-US')}</span>
          </p>
          <p>{gym.description}</p>
          {gym.tags?.length > 0 && (
            <ul className="tags" aria-label="Tags">
              {gym.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
        </article>
      )}
    </main>
  );
}
