// Checks for the enquiry form on the detail page. Plain function, no React.
// Dan's choice (2026-11-15): name, email and message, all required.
// The form does not send anything yet (Task 3 adds a Django endpoint, which
// must check all of this again: the browser's checks can be skipped).

export const NAME_MAX = 100;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;

// Something@something.something, with no spaces and only one @.
// Deliberately simple: the real test of an email is whether a reply arrives.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Gives { box: 'what to fix' } for every box that is wrong, or {} if all is well.
export function enquiryErrors({ name = '', email = '', message = '' } = {}) {
  const errors = {};
  const n = String(name).trim();
  const e = String(email).trim();
  const m = String(message).trim();

  if (!n) errors.name = 'Enter your name.';
  else if (n.length > NAME_MAX) errors.name = `Keep your name under ${NAME_MAX} characters.`;

  if (!e) errors.email = 'Enter your email address.';
  else if (!EMAIL.test(e)) errors.email = 'Enter an email like name@example.com.';

  if (!m) errors.message = 'Enter a message.';
  else if (m.length < MESSAGE_MIN) errors.message = `Write at least ${MESSAGE_MIN} characters.`;
  else if (m.length > MESSAGE_MAX) errors.message = `Keep your message under ${MESSAGE_MAX} characters.`;

  return errors;
}
