// The one place that talks to the API as a logged-in user.
//
// Login lives in httpOnly cookies, so JavaScript never holds a token. This file
// does three jobs for every call:
//   1. sends the cookies along (credentials: 'include');
//   2. on unsafe methods (POST, PUT, PATCH, DELETE) copies Django's csrftoken
//      cookie into the X-CSRFToken header, which a stranger's page cannot read;
//   3. when the API answers 401 (access cookie expired), asks /auth/refresh/ for
//      a new one and repeats the call ONCE. If the refresh fails too, the person
//      is logged out cleanly (listeners are told) and the 401 is thrown.
import { ApiError } from './listings.js';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/+$/, '');

const SAFE = ['GET', 'HEAD', 'OPTIONS'];

// Reads one cookie the page is allowed to see (csrftoken is not httpOnly).
function readCookie(name) {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// --- "your login ended" announcements --------------------------------------
const expiredListeners = new Set();

// AuthContext listens here. Returns a function that stops listening.
export function onSessionExpired(listener) {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

// --- one shared refresh ------------------------------------------------------
// If three requests fail with 401 at the same moment, they must NOT each call
// /auth/refresh/. They all wait for the same promise instead.
let refreshing = null;

function refreshSession() {
  if (!refreshing) {
    refreshing = send('/auth/refresh/', { method: 'POST' })
      .then(() => true, () => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// One raw attempt: no refresh logic. Gives back the parsed body (null for 204) or throws ApiError.
async function send(path, { method = 'GET', body, errorMessage = 'Something went wrong. Please try again.' } = {}) {
  const headers = {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (!SAFE.includes(method)) {
    const csrf = readCookie('csrftoken');
    if (csrf) headers['X-CSRFToken'] = csrf;
  }
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', { status: 0 });
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = response.status >= 500 ? errorMessage : data?.error?.message || errorMessage;
    throw new ApiError(message, { status: response.status, fields: data?.error?.fields ?? {} });
  }
  return response.status === 204 ? null : response.json();
}

// What the rest of the app calls. `auth: false` is for login/register/logout:
// a 401 there means "wrong password", not "refresh and retry".
export async function apiFetch(path, options = {}) {
  const { auth = true, ...rest } = options;
  try {
    return await send(path, rest);
  } catch (error) {
    if (!auth || error.status !== 401) throw error;
  }
  // 401: try to get a fresh access cookie, then repeat once.
  if (await refreshSession()) return send(path, rest);
  expiredListeners.forEach((listener) => listener());
  throw new ApiError('Please log in again.', { status: 401 });
}
