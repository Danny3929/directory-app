// One gym in the results list. It only shows what it is given.
// distanceKm is there only when the visitor entered a known ZIP.
export default function GymCard({ gym }) {
  const hasDistance = Number.isFinite(gym.distanceKm);

  return (
    <li className="card">
      <div className="card-top">
        <h3>{gym.name}</h3>
        {gym.featured && <span className="badge">Featured</span>}
      </div>
      <p className="muted">
        {gym.address}, {gym.area}, {gym.city}
      </p>
      <p className="card-facts">
        <span>Ksh {gym.priceKsh.toLocaleString('en-US')}</span>
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
