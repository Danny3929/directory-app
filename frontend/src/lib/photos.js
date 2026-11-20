// Checks and addresses for gym photos. Plain functions, no React.
// These checks only save a wasted upload and give a friendly message early.
// The SERVER checks again (content, size, count) and is the one that counts.
import { API_URL } from '../api/client.js';

export const MAX_PHOTOS = 5;
export const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Returns an error sentence, or '' when the file looks fine.
export function photoError(file, haveCount) {
  if (haveCount >= MAX_PHOTOS) return `A gym can have at most ${MAX_PHOTOS} photos. Remove one first.`;
  if (!file) return 'Choose a photo first.';
  if (!TYPES.includes(file.type)) return 'Only JPEG, PNG or WebP photos are allowed.';
  if (file.size > MAX_BYTES) return 'That photo is larger than 2 MB.';
  return '';
}

// Where to load a photo from. Uploaded ones have "url" (a path on the API's
// server); the seeded ones have "image", a file name in our own /images folder.
export function photoSrc(photo) {
  if (photo.url) return new URL(photo.url, API_URL).href;
  return `/images/${photo.image}`;
}
