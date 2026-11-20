// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/listings.js';

vi.mock('../api/owner.js', () => ({ uploadGymPhoto: vi.fn(), removeGymPhoto: vi.fn() }));
import { removeGymPhoto, uploadGymPhoto } from '../api/owner.js';
import PhotoManager from './PhotoManager.jsx';

const seeded = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, image: `p${i}.webp`, url: null, alt_text: '' }));
const pick = (f) => fireEvent.change(screen.getByLabelText(/Add a photo/), { target: { files: [f] } });
const jpeg = (size = 1000) => new File([new Uint8Array(size)], 'a.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  [uploadGymPhoto, removeGymPhoto].forEach((f) => f.mockReset());
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
});
afterEach(cleanup);

describe('PhotoManager', () => {
  it('shows a preview of the chosen file and sends nothing until Upload is pressed', () => {
    render(<PhotoManager gymId="7" initial={[]} />);
    pick(jpeg());
    expect(screen.getByAltText('Preview of the photo you chose').getAttribute('src')).toBe('blob:preview');
    expect(uploadGymPhoto).not.toHaveBeenCalled();
  });

  it('uploads with the description and adds the photo to the list', async () => {
    uploadGymPhoto.mockResolvedValue({ id: 9, url: '/media/a.jpg', alt_text: 'The weights room' });
    render(<PhotoManager gymId="7" initial={[]} />);
    pick(jpeg());
    fireEvent.change(screen.getByLabelText(/Describe the photo/), { target: { value: 'The weights room' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }));
    expect(await screen.findByAltText('The weights room')).toBeTruthy();
    expect(uploadGymPhoto.mock.calls[0][0]).toBe('7');
    expect(uploadGymPhoto.mock.calls[0][2]).toBe('The weights room');
    expect(screen.getByText('Photos (1 of 5)')).toBeTruthy();
  });

  it('refuses a wrong type or a 5 MB file before sending, with a message', () => {
    render(<PhotoManager gymId="7" initial={[]} />);
    pick(new File(['MZ'], 'photo.jpg', { type: 'application/x-msdownload' }));
    expect(screen.getByRole('alert').textContent).toMatch(/JPEG, PNG or WebP/);
    pick(jpeg(5 * 1024 * 1024));
    expect(screen.getByRole('alert').textContent).toMatch(/2 MB/);
    expect(screen.queryByRole('button', { name: 'Upload photo' })).toBeNull();
    expect(uploadGymPhoto).not.toHaveBeenCalled();
  });

  it('shows the server message when it refuses, and keeps the chosen file', async () => {
    uploadGymPhoto.mockRejectedValue(new ApiError('That file is not a valid image.', { status: 400 }));
    render(<PhotoManager gymId="7" initial={[]} />);
    pick(jpeg());
    fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/not a valid image/);
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeTruthy();
  });

  it('removes a photo only after the dialog is confirmed', async () => {
    removeGymPhoto.mockResolvedValue(null);
    render(<PhotoManager gymId="7" initial={seeded(2)} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Remove/ })[0]);
    expect(removeGymPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    await waitFor(() => expect(screen.getByText('Photos (1 of 5)')).toBeTruthy());
    expect(removeGymPhoto).toHaveBeenCalledWith('7', 1);
  });

  it('disables adding when the gym already has 5 photos', () => {
    render(<PhotoManager gymId="7" initial={seeded(5)} />);
    expect(screen.getByLabelText(/Add a photo/).disabled).toBe(true);
  });
});
