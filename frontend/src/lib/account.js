// Checks for the login and register forms. Plain functions, no React.
// Moss picked these rules (Dan said "you pick", 2026-11-20). The browser only
// gives quick help: Django checks everything again, because these checks can
// be skipped. Django also refuses common, all-number and email-like passwords;
// the form does not repeat that, it shows the server's message instead.
import { EMAIL } from './enquiry.js';

// Same minimum as Django's MinimumLengthValidator, so the form never lets
// through something the server will refuse for length.
export const PASSWORD_MIN = 8;
// Same limit as the server's password field.
export const PASSWORD_MAX = 128;
export const ROLES = ['visitor', 'owner'];

const emailError = (value) => {
  const e = String(value ?? '').trim();
  if (!e) return 'Enter your email address.';
  if (!EMAIL.test(e)) return 'Enter an email like name@example.com.';
  return undefined;
};

// Log in: only "not empty". Never apply the strength rules here, or an old
// password that no longer meets them would lock its owner out.
export function loginErrors({ email = '', password = '' } = {}) {
  const errors = {};
  const e = emailError(email);
  if (e) errors.email = e;
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

// Register: spaces count as part of a password, so it is not trimmed.
// There is no default role: choosing "owner" is a decision, not an accident.
export function registerErrors({ email = '', password = '', role = '' } = {}) {
  const errors = {};
  const e = emailError(email);
  if (e) errors.email = e;

  const p = String(password ?? '');
  if (!p) errors.password = 'Choose a password.';
  else if (p.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (p.length > PASSWORD_MAX) errors.password = `Keep your password under ${PASSWORD_MAX} characters.`;

  if (!ROLES.includes(role)) errors.role = 'Choose how you will use this site.';
  return errors;
}

// Only follow a "where you were going" address that stays on this site.
// "//evil.example" would leave it, so it is refused.
export const safeFrom = (from) => (typeof from === 'string' && /^\/(?!\/)/.test(from) ? from : '/');
