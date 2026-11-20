// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/listings.js';

vi.mock('../api/owner.js', () => ({ listMyGyms: vi.fn(), deleteMyGym: vi.fn() }));
import { deleteMyGym, listMyGyms } from '../api/owner.js';
vi.mock('../api/billing.js', () => ({ startBoost: vi.fn(), goTo: vi.fn() }));
import { goTo, startBoost } from '../api/billing.js';
import DashboardPage from './DashboardPage.jsx';

const gyms = [
  { id: 1, name: 'Baobab Barbell', area: 'Westlands', is_published: true },
  { id: 2, name: 'Acacia Yoga', area: 'Kilimani', is_published: false },
];
const mount = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

beforeEach(() => {
  // jsdom has no showModal; a plain "open" flag is enough for these tests.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  listMyGyms.mockReset();
  deleteMyGym.mockReset();
  startBoost.mockReset();
  goTo.mockReset();
});
afterEach(cleanup);

describe('DashboardPage', () => {
  it('shows each gym with a status in words', async () => {
    listMyGyms.mockResolvedValue(gyms);
    mount();
    const row = (await screen.findByText('Baobab Barbell')).closest('tr');
    expect(within(row).getByText('Published')).toBeTruthy();
    expect(within(screen.getByText('Acacia Yoga').closest('tr')).getByText('Pending approval')).toBeTruthy();
  });

  it('links to the enquiries inbox', async () => {
    listMyGyms.mockResolvedValue([]);
    mount();
    const link = await screen.findByRole('link', { name: /enquiries inbox/i });
    expect(link.getAttribute('href')).toBe('/dashboard/enquiries');
  });

  it('says so when there are no gyms', async () => {
    listMyGyms.mockResolvedValue([]);
    mount();
    expect(await screen.findByText(/no gyms yet/i)).toBeTruthy();
  });

  it('shows an error with a retry that works', async () => {
    listMyGyms.mockRejectedValueOnce(new ApiError('Could not reach the server.', { status: 0 }));
    listMyGyms.mockResolvedValueOnce(gyms);
    mount();
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not reach/i);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Baobab Barbell')).toBeTruthy();
  });

  it('deletes only after the dialog is confirmed', async () => {
    listMyGyms.mockResolvedValue(gyms);
    deleteMyGym.mockResolvedValue(null);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Acacia Yoga' }));
    expect(deleteMyGym).not.toHaveBeenCalled(); // asking is not deleting
    fireEvent.click(screen.getByRole('button', { name: 'Delete gym' }));
    await waitFor(() => expect(screen.queryByText('Acacia Yoga')).toBeNull());
    expect(deleteMyGym).toHaveBeenCalledWith(2);
    expect(screen.getByText('Baobab Barbell')).toBeTruthy();
  });

  it('Cancel deletes nothing', async () => {
    listMyGyms.mockResolvedValue(gyms);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Acacia Yoga' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(deleteMyGym).not.toHaveBeenCalled();
    expect(screen.getByText('Acacia Yoga')).toBeTruthy();
  });

  it('keeps the gym and shows the server message when delete is refused', async () => {
    listMyGyms.mockResolvedValue(gyms);
    deleteMyGym.mockRejectedValue(new ApiError('This gym has enquiries, so it cannot be deleted.', { status: 409 }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Baobab Barbell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete gym' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/has enquiries/i);
    expect(screen.getByText('Baobab Barbell')).toBeTruthy();
  });

  it('offers Boost only on published gyms and goes to Stripe', async () => {
    listMyGyms.mockResolvedValue(gyms);
    startBoost.mockResolvedValue('https://checkout.stripe.com/c/pay/x');
    mount();
    const button = await screen.findByRole('button', { name: /^Boost Baobab Barbell/ });
    expect(screen.queryByRole('button', { name: /Boost Acacia Yoga/ })).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/x'));
    expect(startBoost).toHaveBeenCalledWith(1);
  });

  it('shows the server message and stays put when checkout fails', async () => {
    listMyGyms.mockResolvedValue(gyms);
    startBoost.mockRejectedValue(new ApiError('Stripe could not be reached. Please try again.', { status: 503 }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Boost Baobab Barbell/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/stripe could not be reached/i);
    expect(goTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Boost Baobab Barbell/ }).disabled).toBe(false);
  });

  it('shows Featured until and Extend boost for a featured gym', async () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    listMyGyms.mockResolvedValue([{ ...gyms[0], featured_until: future }]);
    mount();
    expect(await screen.findByText(/Featured until/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Extend boost for Baobab Barbell/ })).toBeTruthy();
  });
});
