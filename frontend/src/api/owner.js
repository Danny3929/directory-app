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

// The tags a gym can have (a short list, not paged).
export const listTags = () => apiFetch('/tags/');

// Photos. The file goes as multipart form data (apiFetch leaves FormData alone,
// so the browser sets the boundary itself). Gives back the new photo { id, url, alt_text }.
export function uploadGymPhoto(gymId, file, altText = '') {
  const form = new FormData();
  form.append('file', file);
  form.append('alt_text', altText);
  return apiFetch(`/me/listings/${gymId}/images/`, { method: 'POST', body: form });
}
export const removeGymPhoto = (gymId, imageId) =>
  apiFetch(`/me/listings/${gymId}/images/${imageId}/`, { method: 'DELETE' });

// Unpaged unread count for the nav badge, and the inbox (server pages: 12 at a time).
export const unreadCount = () => apiFetch('/me/enquiries/unread-count/').then((d) => d.unread);
export const listEnquiries = (page = 1) => apiFetch(`/me/enquiries/?page=${page}`);
export const markEnquiryRead = (id) => apiFetch(`/me/enquiries/${id}/read/`, { method: 'POST' });
