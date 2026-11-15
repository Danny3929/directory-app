import { useState } from 'react';
import { photoFor } from '../lib/gymImage.js';

// The photos on the detail page: one big photo, and a small button for each
// photo when there is more than one. photos is the gym's list of file names.
export default function PhotoGallery({ photos = [], gymName }) {
  const list = photos.map(photoFor).filter(Boolean);
  // Which photo is big. It remembers the list it belongs to, so a different
  // gym starts again at its first photo.
  const listKey = list.map((p) => p.file).join('|');
  const [pick, setPick] = useState({ listKey, index: 0 });
  const index = pick.listKey === listKey ? pick.index : 0;

  if (list.length === 0) return null;
  const big = list[index];

  return (
    <div className="gallery">
      {/* Not lazy: this is the first thing people see on the page. */}
      <img className="gallery-main detail-photo" src={big.src} alt={big.alt} width="960" height="540" />
      {list.length > 1 && (
        <>
          <p className="muted gallery-count">
            Photo {index + 1} of {list.length}
          </p>
          <div className="gallery-thumbs" role="group" aria-label={`Photos of ${gymName}`}>
            {list.map((photo, i) => (
              <button
                key={photo.file}
                type="button"
                className="gallery-thumb"
                aria-label={`Show photo ${i + 1} of ${list.length}`}
                aria-pressed={i === index}
                onClick={() => setPick({ listKey, index: i })}
              >
                {/* alt="" because the button label already says what it does. */}
                <img src={photo.src} alt="" width="160" height="90" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
