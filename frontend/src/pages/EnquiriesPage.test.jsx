// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/listings.js';

vi.mock('../api/owner.js', () => ({ listEnquiries: vi.fn(), markEnquiryRead: vi.fn(), unreadCount: vi.fn() }));
import { listEnquiries, markEnquiryRead, unreadCount } from '../api/owner.js';
import { useUnread } from '../lib/unread.js';
import EnquiriesPage from './EnquiriesPage.jsx';

const enq = (id, over = {}) => ({
  id, listing_id: 1, listing_name: 'Alpha Gym', name: `Person ${id}`, email: `p${id}@x.co`,
  message: `Hello ${id}`, is_read: false, created_at: '2026-11-18T10:00:00Z', ...over,
});
const mount = () => render(<MemoryRouter><EnquiriesPage /></MemoryRouter>);

beforeEach(() => [listEnquiries, markEnquiryRead, unreadCount].forEach((f) => f.mockReset()));
afterEach(cleanup);

describe('EnquiriesPage', () => {
  it('lists messages with Unread or Read in words', async () => {
    listEnquiries.mockResolvedValue({ results: [enq(1), enq(2, { is_read: true })], next: null });
    mount();
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByText('Unread')).toBeTruthy();
    expect(within(items[1]).getByText('Read')).toBeTruthy();
    expect(within(items[0]).getByText('Hello 1')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Mark the message/ })).toHaveLength(1);
  });

  it('shows message text as text, never as HTML', async () => {
    listEnquiries.mockResolvedValue({ results: [enq(1, { message: '<img src=x onerror=alert(1)>' })], next: null });
    mount();
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });

  it('marks one read only after the server agrees', async () => {
    listEnquiries.mockResolvedValue({ results: [enq(1)], next: null });
    let done;
    markEnquiryRead.mockReturnValue(new Promise((r) => { done = r; }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Mark the message from Person 1/ }));
    expect(screen.getByText('Unread')).toBeTruthy(); // not yet
    done({});
    await waitFor(() => expect(screen.getByText('Read')).toBeTruthy());
    expect(markEnquiryRead).toHaveBeenCalledWith(1);
  });

  it('keeps it unread and says why when the server refuses', async () => {
    listEnquiries.mockResolvedValue({ results: [enq(1)], next: null });
    markEnquiryRead.mockRejectedValue(new ApiError('Could not reach the server.', { status: 0 }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Mark the message/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not reach/);
    expect(screen.getByText('Unread')).toBeTruthy();
  });

  it('loads the next page on request', async () => {
    listEnquiries
      .mockResolvedValueOnce({ results: [enq(1)], next: 'x' })
      .mockResolvedValueOnce({ results: [enq(2)], next: null });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Hello 2')).toBeTruthy();
    expect(listEnquiries).toHaveBeenLastCalledWith(2);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('has empty and error states', async () => {
    listEnquiries.mockResolvedValue({ results: [], next: null });
    mount();
    expect(await screen.findByText(/No enquiries yet/)).toBeTruthy();
    cleanup();
    listEnquiries.mockRejectedValue(new ApiError('Could not reach the server.', { status: 0 }));
    mount();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not reach/);
  });
});

describe('useUnread', () => {
  function Badge({ enabled }) {
    return <p>count:{useUnread(enabled, '/')}</p>;
  }
  it('asks the server for owners and shows the number', async () => {
    unreadCount.mockResolvedValue(3);
    render(<Badge enabled />);
    expect(await screen.findByText('count:3')).toBeTruthy();
  });
  it('does not ask for anyone else, and keeps 0 when the ask fails', async () => {
    render(<Badge enabled={false} />);
    expect(unreadCount).not.toHaveBeenCalled();
    cleanup();
    unreadCount.mockRejectedValue(new Error('down'));
    render(<Badge enabled />);
    await waitFor(() => expect(unreadCount).toHaveBeenCalled());
    expect(screen.getByText('count:0')).toBeTruthy();
  });
});
