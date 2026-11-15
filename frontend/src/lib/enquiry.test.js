import { describe, it, expect } from 'vitest';
import { enquiryErrors, MESSAGE_MIN } from './enquiry.js';

const good = { name: 'Ana Wanjiru', email: 'ana@example.com', message: 'Do you have evening classes?' };

describe('enquiryErrors (Dan: name, email, message all required)', () => {
  it('has no errors for a good enquiry', () => {
    expect(enquiryErrors(good)).toEqual({});
  });

  it('asks for every box when all are empty', () => {
    expect(enquiryErrors({ name: '', email: '', message: '' })).toEqual({
      name: 'Enter your name.',
      email: 'Enter your email address.',
      message: 'Enter a message.',
    });
  });

  it('treats spaces only as empty', () => {
    expect(enquiryErrors({ ...good, name: '   ' }).name).toBe('Enter your name.');
  });

  it('copes with missing fields', () => {
    expect(Object.keys(enquiryErrors({}))).toEqual(['name', 'email', 'message']);
  });

  it.each(['ana', 'ana@', '@example.com', 'ana@example', 'ana example@x.com', 'ana@@x.com'])(
    'rejects %s as an email',
    (email) => {
      expect(enquiryErrors({ ...good, email }).email).toBe('Enter an email like name@example.com.');
    },
  );

  it('accepts an email with spaces around it', () => {
    expect(enquiryErrors({ ...good, email: '  ana@example.co.ke ' })).toEqual({});
  });

  it(`needs a message of at least ${MESSAGE_MIN} characters, not counting outside spaces`, () => {
    expect(enquiryErrors({ ...good, message: '  Hi there  ' }).message).toBe(
      `Write at least ${MESSAGE_MIN} characters.`,
    );
    expect(enquiryErrors({ ...good, message: 'x'.repeat(MESSAGE_MIN) })).toEqual({});
  });

  it('limits very long boxes', () => {
    const errors = enquiryErrors({ name: 'n'.repeat(101), email: good.email, message: 'm'.repeat(2001) });
    expect(errors.name).toBe('Keep your name under 100 characters.');
    expect(errors.message).toBe('Keep your message under 2000 characters.');
  });
});
