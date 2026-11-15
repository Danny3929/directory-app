const KEY = 'gym-favourites';

// Only whole-number ids, each once. Anything else in storage is ignored.
function clean(list) {
  return [...new Set(list.filter((id) => Number.isInteger(id)))];
}

export function loadFavourites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(parsed) ? clean(parsed) : [];
  } catch {
    return [];
  }
}

export function saveFavourites(ids) {
  try {
    localStorage.setItem(KEY, JSON.stringify(clean(ids)));
  } catch {
    // Storage full or blocked: favourites just won't be remembered.
  }
}

export function toggleFavourite(ids, id) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
