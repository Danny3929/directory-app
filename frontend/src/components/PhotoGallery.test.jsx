// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PhotoGallery from './PhotoGallery.jsx';

afterEach(cleanup);

const mainPhoto = () => screen.getByRole('img', { name: /./, hidden: false });

describe('PhotoGallery', () => {
  it('shows one photo and no buttons when there is only one', () => {
    render(<PhotoGallery photos={['yoga.webp']} gymName="Calm Yoga" />);
    expect(mainPhoto().getAttribute('src')).toMatch(/yoga\.webp$/);
    expect(mainPhoto().getAttribute('alt')).toMatch(/yoga mat/i);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows nothing when there are no photos', () => {
    const { container } = render(<PhotoGallery photos={[]} gymName="Bare" />);
    expect(container.innerHTML).toBe('');
  });

  it('skips files it has no photo for', () => {
    render(<PhotoGallery photos={['missing.webp', 'boxing.webp']} gymName="Box" />);
    expect(mainPhoto().getAttribute('src')).toMatch(/boxing\.webp$/);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has a labelled button per photo, the first one pressed', () => {
    render(<PhotoGallery photos={['spin-1.webp', 'strength.webp', 'weights.webp']} gymName="Pedal" />);
    expect(screen.getByRole('group', { name: /photos of pedal/i })).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].getAttribute('aria-label')).toBe('Show photo 1 of 3');
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(screen.getByText('Photo 1 of 3')).toBeTruthy();
  });

  it('a button swaps the big photo and says which one is showing', () => {
    render(<PhotoGallery photos={['spin-1.webp', 'strength.webp', 'weights.webp']} gymName="Pedal" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show photo 3 of 3' }));
    const big = document.querySelector('.gallery-main');
    expect(big.getAttribute('src')).toMatch(/weights\.webp$/);
    expect(big.getAttribute('alt')).toMatch(/dumbbell/i);
    expect(screen.getByText('Photo 3 of 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show photo 3 of 3' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('thumbnails have empty alt, so screen readers hear the button label once', () => {
    render(<PhotoGallery photos={['spin-1.webp', 'strength.webp']} gymName="Pedal" />);
    for (const thumb of document.querySelectorAll('.gallery-thumb img')) {
      expect(thumb.getAttribute('alt')).toBe('');
    }
  });

  it('goes back to the first photo when given a different gym', () => {
    const { rerender } = render(<PhotoGallery photos={['spin-1.webp', 'strength.webp']} gymName="Pedal" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show photo 2 of 2' }));
    rerender(<PhotoGallery photos={['boxing.webp', 'yoga.webp']} gymName="Other" />);
    expect(document.querySelector('.gallery-main').getAttribute('src')).toMatch(/boxing\.webp$/);
  });
});
