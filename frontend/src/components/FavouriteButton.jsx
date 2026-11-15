// A heart toggle. It is a real <button>, so Enter and Space work with no extra code.
// The label stays "Save <gym>" and aria-pressed carries the on/off state, so screen
// readers say "Save Baobab Barbell, toggle button, pressed".
export default function FavouriteButton({ gymName, isFavourite, onToggle }) {
  return (
    <button
      type="button"
      className="fav-button"
      aria-pressed={isFavourite}
      aria-label={`Save ${gymName}`}
      onClick={onToggle}
    >
      <span aria-hidden="true">{isFavourite ? '♥' : '♡'}</span>
    </button>
  );
}
