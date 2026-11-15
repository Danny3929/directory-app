import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import FavouriteButton from '../components/FavouriteButton.jsx';
import { fetchListing, fetchTagCounts } from '../api/listings.js';
import { gymImage } from '../lib/gymImage.js';
import { formatPrice } from '../lib/price.js';
import { parseSearch } from '../lib/urlState.js';
import { backLink, searchOf } from '../lib/route.js';

// One gym in full. The page asks the fake API for it by slug and shows one of:
// loading, error (with Try again), not found, or the gym.
// favourites is the list of saved ids; the heart passes this gym's id up.
export default function DetailPage({ slug, favourites = [], onToggleFavourite }) {
  // The card link left a note of the page it came from (see GymCard).
  const { state: cameFrom } = useLocation();
  const back = backLink(cameFrom);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', gym: null, error: '' });
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    // Only for the photo. If it fails the page still works: ties then go A to Z.
    fetchTagCounts()
      .then((c) => !cancelled && setCounts(c))
      .catch(() => {});
    fetchListing(slug)
      .then((gym) => {
        if (!cancelled) setState({ status: gym ? 'ready' : 'notfound', gym, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', gym: null, error: err.message });
      });
    // Ignore an old answer if the slug changed or the page was left.
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  const retry = () => {
    setState({ status: 'loading', gym: null, error: '' });
    setAttempt((n) => n + 1);
  };

  const { status, gym, error } = state;
  // The search the visitor came from (?q=) picks the same photo the card showed.
  const image = gym && gymImage(gym, { query: parseSearch(searchOf(cameFrom)).q, counts });

  return (
    <main className="page">
      {/* Goes back to the same search (or saved gyms) the visitor came from. */}
      <Link className="back-link" to={back.to}>
        ← {back.label}
      </Link>

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
            {gym.isFeatured && <span className="badge">Featured</span>}
            {onToggleFavourite && (
              <FavouriteButton
                gymName={gym.name}
                isFavourite={favourites.includes(gym.id)}
                onToggle={() => onToggleFavourite(gym.id)}
              />
            )}
          </div>
          <img className="detail-photo" src={image.src} alt={image.alt} width="960" height="540" />
          <p className="muted">
            {gym.address}, {gym.area}, {gym.city}
          </p>
          <p className="card-facts">
            <span>{formatPrice(gym)} a month</span>
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
