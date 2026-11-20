// The owner's own gyms. Every call goes through apiFetch, so the login cookie
// is sent and an expired one is refreshed. The server decides whose gyms these
// are (from the login), so no owner id is ever sent from here.
import { apiFetch } from './client.js';

// All of my gyms. The server pages them 12 at a time; follow "page" until done.
export async function listMyGyms() {
  const gyms = [];
  for (let page = 1; ; page += 1) {
    const data = await apiFetch(`/me/listings/?page=${page}`);
    gyms.push(...data.results);
    if (!data.next) return gyms;
  }
}

export const getMyGym = (id) => apiFetch(`/me/listings/${id}/`);
export const createMyGym = (details) => apiFetch('/me/listings/', { method: 'POST', body: details });
export const updateMyGym = (id, details) => apiFetch(`/me/listings/${id}/`, { method: 'PATCH', body: details });
export const deleteMyGym = (id) => apiFetch(`/me/listings/${id}/`, { method: 'DELETE' });
