// Grey placeholders shown while gyms load. They are only decoration, so the
// wrapper is aria-hidden; the page adds one real "Loading…" message for screen readers.

// One grey card shaped like a GymCard (photo, title, two text lines).
export function GymCardSkeleton() {
  return (
    <li className="card card-skeleton">
      <div className="skeleton skeleton-photo" />
      <div className="skeleton skeleton-line skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line skeleton-short" />
    </li>
  );
}

// The list of grey cards for the search page.
export function GymGridSkeleton({ count = 12 }) {
  return (
    <ul className="gym-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <GymCardSkeleton key={i} />
      ))}
    </ul>
  );
}

// A grey block for the detail page: a photo and a few lines.
export function DetailSkeleton() {
  return (
    <div className="detail-skeleton" aria-hidden="true">
      <div className="skeleton skeleton-photo" />
      <div className="skeleton skeleton-line skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line skeleton-short" />
    </div>
  );
}
