// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/listings.js';

vi.mock('../api/owner.js', () => ({
  createMyGym: vi.fn(), updateMyGym: vi.fn(), getMyGym: vi.fn(), listTags: vi.fn(),
  uploadGymPhoto: vi.fn(), removeGymPhoto: vi.fn(),
}));
import { createMyGym, getMyGym, listTags, updateMyGym } from '../api/owner.js';
import GymFormPage from './GymFormPage.jsx';

const mount = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<p>dashboard list</p>} />
        <Route path="/dashboard/new" element={<GymFormPage />} />
        <Route path="/dashboard/:id/edit" element={<GymFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function fillAll() {
  type('Gym name', 'Baobab Barbell');
  type('Description', 'Big gym');
  type('Street address', '1 Ngong Rd');
  type('City', 'Nairobi');
  type('ZIP code', '00100');
  type('Latitude', '-1.29');
  type('Longitude', '36.8');
  type('Lowest monthly price (KSh)', '3000');
  type('Highest monthly price (KSh)', '8000');
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save gym' }));

beforeEach(() => {
  [createMyGym, updateMyGym, getMyGym, listTags].forEach((f) => f.mockReset());
  listTags.mockResolvedValue([{ name: 'Yoga', slug: 'yoga', count: 3 }]);
});
afterEach(cleanup);

describe('GymFormPage', () => {
  it('shows errors under the boxes and sends nothing when the form is empty', async () => {
    mount('/dashboard/new');
    save();
    expect(await screen.findByText('Enter the gym name.')).toBeTruthy();
    expect(screen.getByLabelText('Gym name').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Gym name'));
    expect(createMyGym).not.toHaveBeenCalled();
  });

  it('creates a gym with numbers as numbers and chosen tags, then returns to the list', async () => {
    createMyGym.mockResolvedValue({ id: 9 });
    mount('/dashboard/new');
    fillAll();
    fireEvent.click(await screen.findByLabelText('Yoga'));
    save();
    expect(await screen.findByText('dashboard list')).toBeTruthy();
    const sent = createMyGym.mock.calls[0][0];
    expect(sent.latitude).toBe(-1.29);
    expect(sent.price_max).toBe(8000);
    expect(sent.tags).toEqual(['yoga']);
    expect(sent).not.toHaveProperty('owner');
    expect(sent).not.toHaveProperty('is_published');
  });

  it('puts a server field error under its box', async () => {
    createMyGym.mockRejectedValue(
      new ApiError('Check the form.', { status: 400, fields: { price_min: ['Minimum price cannot be above the maximum.'] } }),
    );
    mount('/dashboard/new');
    fillAll();
    save();
    expect(await screen.findByText('Minimum price cannot be above the maximum.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull(); // no banner when a box owns the message
  });

  it('shows a banner for a general failure and keeps what was typed', async () => {
    createMyGym.mockRejectedValue(new ApiError('Could not reach the server.', { status: 0 }));
    mount('/dashboard/new');
    fillAll();
    save();
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not reach/i);
    expect(screen.getByLabelText('Gym name').value).toBe('Baobab Barbell');
  });

  it('edit: loads the gym, then saves changes with PATCH', async () => {
    getMyGym.mockResolvedValue({
      id: 4, name: 'Acacia Yoga', description: 'Calm', address: '2 Rd', area: 'Kilimani', city: 'Nairobi',
      zip_code: '00200', latitude: -1.3, longitude: 36.8, price_min: 2000, price_max: 4000, tags: [{ name: 'Yoga', slug: 'yoga' }],
    });
    updateMyGym.mockResolvedValue({});
    mount('/dashboard/4/edit');
    expect((await screen.findByLabelText('Gym name')).value).toBe('Acacia Yoga');
    expect((await screen.findByLabelText('Yoga')).checked).toBe(true);
    type('Gym name', 'Acacia Yoga Studio');
    save();
    await waitFor(() => expect(updateMyGym).toHaveBeenCalled());
    expect(updateMyGym.mock.calls[0][0]).toBe('4');
    expect(updateMyGym.mock.calls[0][1].name).toBe('Acacia Yoga Studio');
  });

  it('edit: says so when the gym is not found (another owner id looks the same)', async () => {
    getMyGym.mockRejectedValue(new ApiError('Not found.', { status: 404 }));
    mount('/dashboard/99/edit');
    expect((await screen.findByRole('alert')).textContent).toMatch(/not found/i);
  });
  it('edit shows the photos of the gym; create says to save first', async () => {
    getMyGym.mockResolvedValue({
      id: 4, name: 'Acacia Yoga', description: 'Calm', address: '2 Rd', area: '', city: 'Nairobi',
      zip_code: '00200', latitude: -1.3, longitude: 36.8, price_min: 2000, price_max: 4000, tags: [],
      images: [{ id: 1, image: 'yoga.webp', url: null, alt_text: 'A calm studio' }],
    });
    mount('/dashboard/4/edit');
    expect(await screen.findByAltText('A calm studio')).toBeTruthy();
    cleanup();
    mount('/dashboard/new');
    expect(await screen.findByText(/Save the gym first/)).toBeTruthy();
    expect(screen.queryByLabelText(/Add a photo/)).toBeNull();
  });
});
