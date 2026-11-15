import { describe, it, expect } from 'vitest';
import { tagLabel } from './tags.js';

describe('tagLabel', () => {
  it('turns a tag into words a visitor reads', () => {
    expect(tagLabel('boxing')).toBe('Boxing');
    expect(tagLabel('personal-training')).toBe('Personal training');
    expect(tagLabel('womens')).toBe("Women's");
  });
});
