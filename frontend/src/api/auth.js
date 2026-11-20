// The account calls. Each gives back the user: { id, email, role }.
import { apiFetch } from './client.js';

export const register = ({ email, password, role }) =>
  apiFetch('/auth/register/', { method: 'POST', body: { email, password, role }, auth: false });

export const login = ({ email, password }) =>
  apiFetch('/auth/login/', { method: 'POST', body: { email, password }, auth: false });

export const logout = () => apiFetch('/auth/logout/', { method: 'POST', auth: false });

// Who is logged in right now? Throws ApiError (401) if nobody.
export const currentUser = () => apiFetch('/auth/me/');
