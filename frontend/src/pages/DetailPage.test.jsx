// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import DetailPage from './DetailPage.jsx';
import { fetchListing } from '../api/listings.js';

vi.mock('../api/listings.js', () => ({
  fetchListing: vi.fn(),
}));

const gym = {
  id: 3, name: 'Baobab Barbell', description: 'Boxing bags and coached sessions.',
  tags: ['boxing', 'strength'], address: '59 Wood Ave', area: 'Kilimani', city: 'Nairobi',
  priceKsh: 3500, featured: true, lat: -1.29, lng: 36.78,
};

beforeEach(() => {
  fetchListing.mockReset().mockResolvedValue(structuredClone(gym));
});

afterEach(cleanup);

describe('DetailPage', () => {
  it('shows a loading message, then the gym', async () => {
    render(<DetailPage gymId={3} />);
    expect(screen.getByText(/loading gym/i)).toBeTruthy();
    await screen.findByRole('heading', { level: 1, name: 'Baobab Barbell' });
    expect(screen.queryByText(/loading gym/i)).toBeNull();
    expect(fetchListing.mock.calls[0][0]).toBe(3);
  });

  it('shows address, price, description and tags', async () => {
    render(<DetailPage gymId={3} />);
    await screen.findByText('Baobab Barbell');
    expect(screen.getByText(/59 Wood Ave, Kilimani, Nairobi/)).toBeTruthy();
    expect(screen.getByText(/Ksh 3,500/)).toBeTruthy();
    expect(screen.getByText('Boxing bags and coached sessions.')).toBeTruthy();
    expect(screen.getByText('strength')).toBeTruthy();
    expect(screen.getByText('Featured')).toBeTruthy();
  });

  it('has a Back to search link that goes to the search page', async () => {
    render(<DetailPage gymId={3} />);
    await screen.findByText('Baobab Barbell');
    const back = screen.getByRole('link', { name: /back to search/i });
    expect(back.getAttribute('href')).toBe('#/');
  });

  it('says the gym was not found when there is no such gym', async () => {
    fetchListing.mockResolvedValue(null);
    render(<DetailPage gymId={999} />);
    await screen.findByText(/we could not find that gym/i);
    expect(screen.getByRole('link', { name: /back to search/i })).toBeTruthy();
  });

  it('shows the error and a Try again button that loads again', async () => {
    fetchListing.mockRejectedValueOnce(new Error('Could not load this gym. Please try again.'));
    render(<DetailPage gymId={3} />);
    await screen.findByText('Could not load this gym. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByRole('heading', { level: 1, name: 'Baobab Barbell' });
    expect(fetchListing).toHaveBeenCalledTimes(2);
  });

  it('loads the new gym when the id changes', async () => {
    const { rerender } = render(<DetailPage gymId={3} />);
    await screen.findByText('Baobab Barbell');
    fetchListing.mockResolvedValue({ ...gym, id: 4, name: 'Other Gym' });
    rerender(<DetailPage gymId={4} />);
    await screen.findByText('Other Gym');
  });
});

describe('DetailPage favourite button', () => {
  it('shows a pressed heart and calls onToggleFavourite', async () => {
    const onToggle = vi.fn();
    render(<DetailPage gymId={3} isFavourite={true} onToggleFavourite={onToggle} />);
    const btn = await screen.findByRole('button', { name: /save baobab barbell/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
