// Small helpers for the page addresses. React Router does the matching
// (see App.jsx); these only build links and read the "where from" note.

export function gymPath(slug) {
  return `/listing/${encodeURIComponent(slug)}`;
}

// A card link carries a note of the page it was on: { from: '/?q=box' }.
// We only trust our own two list pages, so a strange note can never send
// the visitor somewhere else (another site, or a javascript: link).
const LIST_PAGE = /^\/(favourites)?(\?[^#]*)?$/;

function fromOf(state) {
  const from = state?.from;
  return typeof from === 'string' && LIST_PAGE.test(from) ? from : null;
}

// Where "Back" goes on the detail page, and what it says.
export function backLink(state) {
  const from = fromOf(state);
  if (from?.startsWith('/favourites')) return { to: from, label: 'Back to saved gyms' };
  return { to: from ?? '/', label: 'Back to search' };
}

// The ?query part of where the visitor came from ('' if none), so the
// detail page can pick the same photo the card showed.
export function searchOf(state) {
  const from = fromOf(state) ?? '';
  const at = from.indexOf('?');
  return at === -1 ? '' : from.slice(at);
}
