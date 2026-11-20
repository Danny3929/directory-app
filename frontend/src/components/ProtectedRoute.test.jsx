// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

let auth;
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => auth }));
import ProtectedRoute from './ProtectedRoute.jsx';

function LoginProbe() {
  const { state } = useLocation();
  return <p>login page, from {state?.from}</p>;
}
const mount = (role) =>
  render(
    <MemoryRouter initialEntries={['/dashboard?tab=1']}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/dashboard" element={<ProtectedRoute role={role}><p>secret dashboard</p></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(cleanup);

describe('ProtectedRoute', () => {
  it('waits while loading: no redirect, no content', () => {
    auth = { user: null, loading: true };
    mount('owner');
    expect(screen.getByRole('status').textContent).toMatch(/checking/i);
    expect(screen.queryByText('secret dashboard')).toBeNull();
    expect(screen.queryByText(/login page/)).toBeNull();
  });

  it('sends a logged-out visitor to /login and remembers where they were going', () => {
    auth = { user: null, loading: false };
    mount('owner');
    expect(screen.getByText('login page, from /dashboard?tab=1')).toBeTruthy();
    expect(screen.queryByText('secret dashboard')).toBeNull();
  });

  it('refuses the wrong role with an explanation, not a redirect', () => {
    auth = { user: { email: 'v@x.co', role: 'visitor' }, loading: false };
    mount('owner');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/gym owners/);
    expect(screen.queryByText('secret dashboard')).toBeNull();
  });

  it('shows the page to the right role', () => {
    auth = { user: { email: 'o@x.co', role: 'owner' }, loading: false };
    mount('owner');
    expect(screen.getByText('secret dashboard')).toBeTruthy();
  });

  it('with no role given, any logged-in user gets in', () => {
    auth = { user: { email: 'v@x.co', role: 'visitor' }, loading: false };
    mount(undefined);
    expect(screen.getByText('secret dashboard')).toBeTruthy();
  });
});
