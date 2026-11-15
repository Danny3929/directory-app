// The page is chosen by the part of the address after the #.
// The search choices (?q=, ?zip=, ?sort=) stay in the normal part, so
// going back to '#/' keeps them.
export function parseRoute(hash) {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '');
  if (path === '') return { page: 'search' };
  const match = /^\/gym\/(\d+)$/.exec(path);
  if (match) return { page: 'gym', id: Number(match[1]) };
  return { page: 'notfound' };
}

export function gymPath(id) {
  return `#/gym/${id}`;
}
