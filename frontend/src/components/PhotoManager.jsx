import { useEffect, useId, useRef, useState } from 'react';
import { removeGymPhoto, uploadGymPhoto } from '../api/owner.js';
import { MAX_PHOTOS, photoError, photoSrc } from '../lib/photos.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Photos of one gym: the ones it has (with Remove), and a way to add one.
// Adding is two steps so a wrong pick is easy to undo: choose a file, SEE it
// (preview), describe it, then press Upload.
export default function PhotoManager({ gymId, initial }) {
  const id = useId();
  const [photos, setPhotos] = useState(initial);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [alt, setAlt] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(null);

  // The preview is a temporary address for the chosen file. It is made when the
  // file is chosen and freed when the file is replaced, cleared or the page closes.
  const latest = useRef('');
  useEffect(() => () => { if (latest.current) URL.revokeObjectURL(latest.current); }, []);
  const setChosen = (next) => {
    if (latest.current) URL.revokeObjectURL(latest.current);
    latest.current = next ? URL.createObjectURL(next) : '';
    setFile(next);
    setPreview(latest.current);
  };

  const choose = (event) => {
    const picked = event.target.files?.[0] ?? null;
    setMessage('');
    const problem = picked ? photoError(picked, photos.length) : '';
    setError(problem);
    setChosen(problem ? null : picked);
    if (problem) event.target.value = '';
  };

  const upload = async () => {
    const problem = photoError(file, photos.length);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    try {
      const added = await uploadGymPhoto(gymId, file, alt.trim());
      setPhotos((list) => [...list, added]);
      setChosen(null);
      setAlt('');
      setMessage('Photo added.');
    } catch (err) {
      setError(err.message); // the server's words: too big, not an image, too many
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await removeGymPhoto(gymId, asking.id);
      setPhotos((list) => list.filter((p) => p.id !== asking.id));
      setMessage('Photo removed.');
      setAsking(null);
    } catch (err) {
      setAsking(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="photos" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>Photos ({photos.length} of {MAX_PHOTOS})</h2>
      {photos.length === 0 && <p>No photos yet.</p>}
      <ul className="photo-list">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <img src={photoSrc(photo)} alt={photo.alt_text || `Photo ${i + 1} of this gym`} width="160" height="120" />
            <button type="button" onClick={() => setAsking({ id: photo.id, n: i + 1 })} disabled={busy}>
              Remove<span className="sr-only"> photo {i + 1}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="field">
        <label htmlFor={`${id}-file`}>Add a photo (JPEG, PNG or WebP, up to 2 MB)</label>
        <input id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={busy || photos.length >= MAX_PHOTOS} />
      </div>
      {file && (
        <div className="photo-preview">
          <img src={preview} alt="Preview of the photo you chose" width="160" height="120" />
          <div className="field">
            <label htmlFor={`${id}-alt`}>Describe the photo (optional, for screen readers)</label>
            <input id={`${id}-alt`} type="text" maxLength={200} value={alt} onChange={(e) => setAlt(e.target.value)} />
          </div>
          <button type="button" onClick={upload} disabled={busy}>{busy ? 'Uploading…' : 'Upload photo'}</button>
          <button type="button" onClick={() => setChosen(null)} disabled={busy}>Cancel</button>
        </div>
      )}
      {error && <div className="notice notice-error" role="alert"><p>{error}</p></div>}
      <p role="status">{message}</p>

      {asking && (
        <ConfirmDialog title={`Remove photo ${asking.n}?`} confirmLabel="Remove photo" busy={busy} onConfirm={remove} onCancel={() => setAsking(null)}>
          <p>The photo is deleted for good.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
