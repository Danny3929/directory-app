import { Link, useLocation } from 'react-router';
import { gymPath } from '../lib/route.js';
import { formatPrice, formatKsh } from '../lib/price.js';
import FavouriteButton from './FavouriteButton.jsx';

// One gym in the results list. It only shows what it is given.
// distanceKm is there only when the visitor entered a known ZIP.
// image is { src, alt } from gymImage(); the card works without it.
// overBudget is the visitor's Max when some of this gym's plans cost more (Dan's 'show, but mark it').
export default function GymCard({ gym, image, overBudget = null, isFavourite = false, onToggleFavourite }) {
  const hasDistance = Number.isFinite(gym.distanceKm);
  // The link remembers this page (with its ?search), so Back on the detail page returns here.
  const here = useLocation();

  return (
    <li className="card">
      {image && (
        // width/height reserve the space before the photo loads, so the list does not jump.
        <img className="card-photo" src={image.src} alt={image.alt} width="960" height="540" loading="lazy" decoding="async" />
      )}
      <div className="card-top">
        <h3>
          <Link to={gymPath(gym.slug)} state={{ from: here.pathname + here.search }}>
            {gym.name}
          </Link>
        </h3>
        {gym.isFeatured && <span className="badge">Featured</span>}
        {onToggleFavourite && (
          <FavouriteButton gymName={gym.name} isFavourite={isFavourite} onToggle={onToggleFavourite} />
        )}
      </div>
      <p className="muted">
        {gym.address}, {gym.area}, {gym.city}
      </p>
      <p className="card-facts">
        <span>{formatPrice(gym)} a month</span>
        {/* Words, not only a colour, so everyone can tell. */}
        {overBudget != null && <span className="price-note">Some plans over Ksh {formatKsh(overBudget)}</span>}
        {hasDistance && <span>{gym.distanceKm.toFixed(2)} km away</span>}
      </p>
      <p>{gym.description}</p>
      {gym.tags?.length > 0 && (
        <ul className="tags" aria-label="Tags">
          {gym.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
