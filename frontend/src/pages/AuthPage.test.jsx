// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/listings.js';

let auth;
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => auth }));
import AuthPage from './AuthPage.jsx';
import { safeFrom } from '../lib/account.js';

// Tiny stand-ins for a person: set a box's text, pick an option, press a button.
const userEvent = {
  type: async (box, text) => fireEvent.change(box, { target: { value: text } }),
  selectOptions: async (box, value) => fireEvent.change(box, { target: { value } }),
  click: async (button) => fireEvent.click(button),
};

const mount = (mode, state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: `/${mode}`, state }]}>
      <Routes>
        <Route path={`/${mode}`} element={<AuthPage mode={mode} />} />
        <Route path="/dashboard" element={<p>dashboard page</p>} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  auth = { user: null, login: vi.fn(), register: vi.fn() };
});
afterEach(cleanup);

describe('login page', () => {
  it('shows errors under the boxes and does not call the server when empty', async () => {
    mount('login');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('logs in and goes back to the page the visitor was headed for', async () => {
    auth.login.mockResolvedValue({ id: 1, email: 'o@x.co', role: 'owner' });
    mount('login', { from: '/dashboard' });
    await userEvent.type(screen.getByLabelText('Email'), ' o@x.co ');
    await userEvent.type(screen.getByLabelText('Password'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(auth.login).toHaveBeenCalledWith({ email: 'o@x.co', password: 'pw' });
    expect(await screen.findByText('dashboard page')).toBeTruthy();
  });

  it('a wrong password shows the server message in an alert banner', async () => {
    auth.login.mockRejectedValue(new ApiError('Wrong email or password.', { status: 401 }));
    mount('login');
    await userEvent.type(screen.getByLabelText('Email'), 'o@x.co');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/wrong email or password/i);
  });
});

describe('register page', () => {
  it('requires a role: no default', async () => {
    mount('register');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/Password/), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByText('Choose how you will use this site.')).toBeTruthy();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('shows the server message for one box under that box, not in a banner', async () => {
    auth.register.mockRejectedValue(
      new ApiError('Check the form.', { status: 400, fields: { password: ['This password is too common.'] } }),
    );
    mount('register');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/Password/), 'password123');
    await userEvent.selectOptions(screen.getByLabelText('I want to'), 'owner');
    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(await screen.findByText('This password is too common.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('registers, then logs in', async () => {
    auth.register.mockResolvedValue({});
    auth.login.mockResolvedValue({ id: 1, email: 'a@b.co', role: 'owner' });
    mount('register');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/Password/), 'longenough1');
    await userEvent.selectOptions(screen.getByLabelText('I want to'), 'owner');
    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    await waitFor(() => expect(auth.login).toHaveBeenCalled());
    expect(auth.register).toHaveBeenCalledWith({ email: 'a@b.co', password: 'longenough1', role: 'owner' });
  });
});

describe('safeFrom', () => {
  it('only follows addresses on this site', () => {
    expect(safeFrom('/dashboard?x=1')).toBe('/dashboard?x=1');
    expect(safeFrom('//evil.example')).toBe('/');
    expect(safeFrom('https://evil.example')).toBe('/');
    expect(safeFrom(undefined)).toBe('/');
  });
});
