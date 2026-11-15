// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FavouriteButton from './FavouriteButton.jsx';

afterEach(cleanup);

describe('FavouriteButton', () => {
  it('is a real button named after the gym, not pressed when not saved', () => {
    render(<FavouriteButton gymName="Baobab Barbell" isFavourite={false} onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: /save baobab barbell/i });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('says pressed when the gym is saved', () => {
    render(<FavouriteButton gymName="Baobab Barbell" isFavourite={true} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /save baobab barbell/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onToggle when clicked (Enter and Space click a real button too)', () => {
    const onToggle = vi.fn();
    render(<FavouriteButton gymName="Baobab Barbell" isFavourite={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not submit a form or follow a link around it', () => {
    render(<FavouriteButton gymName="X" isFavourite={false} onToggle={() => {}} />);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});
