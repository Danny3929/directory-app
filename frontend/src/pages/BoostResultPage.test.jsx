// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/billing.js', () => ({ listBoosts: vi.fn() }));
import { listBoosts } from '../api/billing.js';
import BoostResultPage from './BoostResultPage.jsx';

const pending = { id: 1, listing_name: 'Baobab Barbell', status: 'pending', featured_until: null, stripe_session_id: 'cs_1' };
const paid = { ...pending, status: 'paid', featured_until: '2026-12-20T10:00:00Z' };
const page = (...results) => ({ results, next: null });
const mount = (outcome, url) => render(
  <MemoryRouter initialEntries={[url]}><BoostResultPage outcome={outcome} /></MemoryRouter>,
);
// Let pending promises and timers run.
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const wait = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => { vi.useFakeTimers(); listBoosts.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('BoostResultPage', () => {
  it('waits, then says confirmed only once the server says paid', async () => {
    listBoosts.mockResolvedValueOnce(page(pending)).mockResolvedValue(page(paid));
    mount('success', '/dashboard/boost/success?session_id=cs_1');
    await flush();
    expect(screen.getByRole('status').textContent).toMatch(/waiting for stripe/i);
    await wait(3000);
    expect(screen.getByRole('status').textContent).toMatch(/confirmed.*baobab barbell.*featured until 20 dec 2026/i);
  });

  it('typing the success address by hand never claims a payment', async () => {
    // Another person's paid boost is in no list of mine; the server only gives me mine.
    listBoosts.mockResolvedValue(page());
    mount('success', '/dashboard/boost/success?session_id=cs_made_up');
    await wait(3000 * 10);
    expect(screen.getByRole('status').textContent).toMatch(/has not confirmed/i);
    expect(screen.queryByText(/confirmed\./i)).toBeNull();
    expect(listBoosts).toHaveBeenCalledTimes(10); // stops asking after 10 tries
  });

  it('with no session id says there is nothing to look up', async () => {
    mount('success', '/dashboard/boost/success');
    await flush();
    expect(screen.getByRole('status').textContent).toMatch(/no payment to look up/i);
    expect(listBoosts).not.toHaveBeenCalled();
  });

  it('shows an error when the server cannot be reached', async () => {
    listBoosts.mockRejectedValue(new Error('Could not reach the server.'));
    mount('success', '/dashboard/boost/success?session_id=cs_1');
    await flush();
    expect(screen.getByRole('alert').textContent).toMatch(/could not reach/i);
  });

  it('cancel page says no payment was taken', async () => {
    mount('cancelled', '/dashboard/boost/cancelled');
    expect(screen.getByText(/no payment was taken/i)).toBeTruthy();
  });
});
