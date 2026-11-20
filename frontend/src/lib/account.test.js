import { describe, it, expect } from 'vitest';
import { loginErrors, registerErrors, PASSWORD_MIN, PASSWORD_MAX } from './account.js';

const goodRegister = { email: 'ana@example.com', password: 'a-long-enough-pass', role: 'owner' };

describe('loginErrors', () => {
  it('has no errors for an email and a password', () => {
    expect(loginErrors({ email: 'ana@example.com', password: 'x' })).toEqual({});
  });

  it('asks for both when empty, and treats a spaces-only email as empty', () => {
    expect(loginErrors({ email: '   ', password: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
  });

  it('does not apply the register strength rules to an existing password', () => {
    expect(loginErrors({ email: 'ana@example.com', password: '123' }).password).toBeUndefined();
  });

  it('copes with missing fields', () => {
    expect(Object.keys(loginErrors({}))).toEqual(['email', 'password']);
  });
});

describe('registerErrors', () => {
  it('has no errors for a good registration', () => {
    expect(registerErrors(goodRegister)).toEqual({});
    expect(registerErrors({ ...goodRegister, role: 'visitor' })).toEqual({});
  });

  it('asks for everything when empty', () => {
    expect(registerErrors({})).toEqual({
      email: 'Enter your email address.',
      password: 'Choose a password.',
      role: 'Choose how you will use this site.',
    });
  });

  it.each(['ana', 'ana@', 'ana@example', 'ana example@x.com'])('rejects %s as an email', (email) => {
    expect(registerErrors({ ...goodRegister, email }).email).toBe('Enter an email like name@example.com.');
  });

  it('accepts a password of exactly the minimum, rejects one character fewer', () => {
    expect(registerErrors({ ...goodRegister, password: 'x'.repeat(PASSWORD_MIN) }).password).toBeUndefined();
    expect(registerErrors({ ...goodRegister, password: 'x'.repeat(PASSWORD_MIN - 1) }).password).toBe(
      `Use at least ${PASSWORD_MIN} characters.`,
    );
  });

  it('rejects a password over the maximum', () => {
    expect(registerErrors({ ...goodRegister, password: 'x'.repeat(PASSWORD_MAX + 1) }).password).toMatch(/under 128/);
  });

  it('does not trim the password: 8 spaces are 8 characters', () => {
    expect(registerErrors({ ...goodRegister, password: ' '.repeat(PASSWORD_MIN) }).password).toBeUndefined();
  });

  it.each(['', 'admin', 'Owner', undefined])('rejects %j as a role', (role) => {
    expect(registerErrors({ ...goodRegister, role }).role).toBe('Choose how you will use this site.');
  });
});
