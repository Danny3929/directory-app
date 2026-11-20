// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext.jsx';

const API = 'http://localhost:8000/api/v1';
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unauthorized = () => json({ error: { code: 'unauthorized', message: 'No.' } }, 401);

function Probe() {
  const { user, loading, login, logout } = useAuth();
  if (loading) return <p>loading</p>;
  return (
    <div>
      <p>{user ? `in:${user.email}` : 'out'}</p>
      <button onClick={() => login({ email: 'a@b.co', password: 'x' }).catch(() => {})}>login</button>
      <button onClick={() => logout().catch(() => {})}>logout</button>
    </div>
  );
}
const mount = () => render(<AuthProvider><Probe /></AuthProvider>);

// path -> Response factory
const backend = (routes) => vi.fn((url, init = {}) => {
  const key = `${init.method ?? 'GET'} ${url.replace(API, '')}`;
  return Promise.resolve(routes[key]?.() ?? unauthorized());
});

afterEach(cleanup);

describe('AuthProvider', () => {
  it('shows loading, then the user the server names', async () => {
    vi.stubGlobal('fetch', backend({ 'GET /auth/me/': () => json({ id: 1, email: 'o@x.co', role: 'owner' }) }));
    mount();
    expect(screen.getByText('loading')).toBeTruthy();
    expect(await screen.findByText('in:o@x.co')).toBeTruthy();
  });

  it('a visitor with no login ends up logged out, not stuck loading', async () => {
    vi.stubGlobal('fetch', backend({}));
    mount();
    expect(await screen.findByText('out')).toBeTruthy();
  });

  it('login sets the user; logout clears it even if the server call fails', async () => {
    vi.stubGlobal('fetch', backend({
      'POST /auth/login/': () => json({ id: 2, email: 'a@b.co', role: 'visitor' }),
      'POST /auth/logout/': () => json({}, 500),
    }));
    mount();
    await screen.findByText('out');
    await act(async () => { screen.getByText('login').click(); });
    expect(await screen.findByText('in:a@b.co')).toBeTruthy();
    await act(async () => { screen.getByText('logout').click(); });
    await waitFor(() => expect(screen.getByText('out')).toBeTruthy());
  });

  it('a failed login leaves the user logged out', async () => {
    vi.stubGlobal('fetch', backend({}));
    mount();
    await screen.findByText('out');
    await act(async () => { screen.getByText('login').click(); });
    expect(screen.getByText('out')).toBeTruthy();
  });

  it('useAuth outside the provider throws a clear error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
