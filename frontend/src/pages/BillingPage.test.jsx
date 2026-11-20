// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/billing.js', () => ({ listBoosts: vi.fn() }));
import { listBoosts } from '../api/billing.js';
import BillingPage from './BillingPage.jsx';

const boost = (id, extra = {}) => ({
  id, listing_name: `Gym ${id}`, amount_ksh: 500, days: 30, status: 'paid',
  created_at: '2026-11-20T08:00:00Z', featured_until: '2026-12-20T08:00:00Z', ...extra,
});
const mount = () => render(<MemoryRouter><BillingPage /></MemoryRouter>);

// Braces matter: a function returned from beforeEach is run as a cleanup step.
beforeEach(() => { listBoosts.mockReset(); });
afterEach(cleanup);

describe('BillingPage', () => {
  it('lists boosts with amount and status in words', async () => {
    listBoosts.mockResolvedValue({ results: [boost(1), boost(2, { status: 'pending', featured_until: null })], next: null });
    mount();
    const row = (await screen.findByText('Gym 1')).closest('tr');
    expect(within(row).getByText('Ksh 500')).toBeTruthy();
    expect(within(row).getByText('Paid')).toBeTruthy();
    expect(within(screen.getByText('Gym 2').closest('tr')).getByText('Not confirmed')).toBeTruthy();
  });

  it('says so when there are no boosts', async () => {
    listBoosts.mockResolvedValue({ results: [], next: null });
    mount();
    expect(await screen.findByText(/no boosts yet/i)).toBeTruthy();
  });

  it('loads the next page', async () => {
    listBoosts
      .mockResolvedValueOnce({ results: [boost(1)], next: 'page2' })
      .mockResolvedValueOnce({ results: [boost(2)], next: null });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Gym 2')).toBeTruthy();
    expect(listBoosts).toHaveBeenLastCalledWith(2);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('shows an error when loading fails', async () => {
    listBoosts.mockRejectedValue(new Error('Could not reach the server.'));
    mount();
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not reach/i);
  });
});
