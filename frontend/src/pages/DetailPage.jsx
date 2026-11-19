import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import FavouriteButton from '../components/FavouriteButton.jsx';
import GymCard from '../components/GymCard.jsx';
import PhotoGallery from '../components/PhotoGallery.jsx';
import EnquiryForm from '../components/EnquiryForm.jsx';
import { DetailSkeleton } from '../components/Skeletons.jsx';
import { fetchListing, fetchSimilarListings, fetchTagCounts } from '../api/listings.js';
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
  // Similar gyms load on their own, so a failure there never hides the gym.
  // Each answer remembers which load it belongs to; until the current one
  // answers, the section shows 'loading' (no setState inside the effect).
  const [similarTry, setSimilarTry] = useState(0);
  const similarKey = `#`;
  const [similarAnswer, setSimilarAnswer] = useState(null);
  const similar =
    similarAnswer?.key === similarKey ? similarAnswer : { status: 'loading', gyms: [] };

  useEffect(() => {
    let cancelled = false;
    const key = `#`;
    fetchSimilarListings(slug)
      .then((gyms) => !cancelled && setSimilarAnswer({ key, status: 'ready', gyms }))
      .catch((err) => !cancelled && setSimilarAnswer({ key, status: 'error', gyms: [], error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [slug, similarTry]);

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
  const query = parseSearch(searchOf(cameFrom)).q;
  const image = gym && gymImage(gym, { query, counts });
  // The gallery starts on the photo the card showed, then the gym's others.
  const shownFile = image?.src.split('/').pop();
  const photos = gym ? [shownFile, ...(gym.photos ?? []).filter((f) => f !== shownFile)] : [];

  const titles = { loading: 'Loading gym', error: 'Could not load gym', notfound: 'Gym not found' };

  return (
    <main className="page">
      {/* React moves <title> into the page head: it is the browser tab's name. */}
      <title>{`${status === 'ready' ? gym.name : titles[status]} | Nairobi gyms`}</title>
      {/* Goes back to the same search (or saved gyms) the visitor came from. */}
      <Link className="back-link" to={back.to}>
        ← {back.label}
      </Link>

      {status === 'loading' && (
        <>
          <p role="status" className="visually-hidden">Loading gym…</p>
          <DetailSkeleton />
        </>
      )}

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
          <h1>Gym not found</h1>
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
          <PhotoGallery photos={photos} gymName={gym.name} />
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

      {status === 'ready' && <EnquiryForm key={slug} gymName={gym.name} />}

      {/* Shown while loading or failed; hidden only once we know there are none. */}
      {status === 'ready' && (similar.status !== 'ready' || similar.gyms.length > 0) && (
        <section className="similar" aria-labelledby="similar-heading">
          <h2 id="similar-heading">Similar gyms</h2>
          {similar.status === 'loading' && <p role="status">Loading similar gyms…</p>}
          {similar.status === 'error' && (
            <div className="notice notice-error" role="alert">
              <p>{similar.error}</p>
              <button type="button" onClick={() => setSimilarTry((n) => n + 1)}>
                Try again
              </button>
            </div>
          )}
          {similar.status === 'ready' && (
            <ul className="gym-grid">
              {similar.gyms.map((other) => (
                <GymCard
                  key={other.id}
                  gym={other}
                  image={gymImage(other, { query, counts })}
                  isFavourite={favourites.includes(other.id)}
                  onToggleFavourite={onToggleFavourite && (() => onToggleFavourite(other.id))}
                  // Keep the visitor's original search, so Back still goes there.
                  from={back.to}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
