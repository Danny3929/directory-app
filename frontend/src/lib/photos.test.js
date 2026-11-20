import { describe, expect, it } from 'vitest';
import { MAX_BYTES, photoError, photoSrc } from './photos.js';

const file = (type, size = 1000) => ({ type, size });

describe('photoError', () => {
  it('accepts a small JPEG, PNG or WebP', () => {
    ['image/jpeg', 'image/png', 'image/webp'].forEach((t) => expect(photoError(file(t), 0)).toBe(''));
  });
  it('refuses other types, big files, no file, and a sixth photo', () => {
    expect(photoError(file('application/x-msdownload'), 0)).toMatch(/JPEG, PNG or WebP/);
    expect(photoError(file('image/gif'), 0)).toMatch(/JPEG, PNG or WebP/);
    expect(photoError(file('image/png', MAX_BYTES + 1), 0)).toMatch(/2 MB/);
    expect(photoError(file('image/png', MAX_BYTES), 0)).toBe('');
    expect(photoError(null, 0)).toMatch(/Choose/);
    expect(photoError(file('image/png'), 5)).toMatch(/at most 5/);
  });
});

describe('photoSrc', () => {
  it('points an uploaded photo at the API server, and a seeded one at our images folder', () => {
    expect(photoSrc({ url: '/media/gyms/a.jpg' })).toMatch(/^https?:\/\/[^/]+\/media\/gyms\/a\.jpg$/);
    expect(photoSrc({ url: null, image: 'boxing.webp' })).toBe('/images/boxing.webp');
  });
});
