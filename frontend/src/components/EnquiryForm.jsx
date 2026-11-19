import { useEffect, useId, useRef, useState } from 'react';
import { sendEnquiry } from '../api/listings.js';
import { enquiryErrors, MESSAGE_MIN } from '../lib/enquiry.js';

const EMPTY = { name: '', email: '', message: '' };
const ORDER = ['name', 'email', 'message'];

// The enquiry form on the detail page. The browser checks first (quick help),
// then Django checks again, because the browser's checks can be skipped.
export default function EnquiryForm({ gymName, slug }) {
  const id = useId();
  const [values, setValues] = useState(EMPTY);
  // Errors only show after the first Send, so nobody is told off mid-typing.
  const [tried, setTried] = useState(false);
  const [sentBy, setSentBy] = useState(null);
  const [sending, setSending] = useState(false);
  // What the server said was wrong: { fields: { email: 'text' }, message: 'text' }.
  const [serverError, setServerError] = useState(null);
  const boxes = { name: useRef(null), email: useRef(null), message: useRef(null) };
  const thanksRef = useRef(null);
  const problemRef = useRef(null);
  // What to focus after the screen changes: 'thanks' or 'name'.
  const [focusNext, setFocusNext] = useState(null);

  const errors = { ...(tried ? enquiryErrors(values) : {}), ...(serverError?.fields ?? {}) };

  useEffect(() => {
    if (focusNext === 'thanks') thanksRef.current?.focus();
    if (focusNext === 'name') boxes.name.current?.focus();
    if (focusNext === 'problem') problemRef.current?.focus();
    if (focusNext) setFocusNext(null);
    // boxes are refs, they never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNext]);

  const change = (event) => {
    setValues((v) => ({ ...v, [event.target.name]: event.target.value }));
    // Typing in a box clears the server's complaint about that box.
    setServerError((e) => e && { ...e, fields: { ...e.fields, [event.target.name]: undefined } });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    const found = enquiryErrors(values);
    const firstWrong = ORDER.find((box) => found[box]);
    if (firstWrong) {
      setTried(true);
      // Take keyboard and screen-reader users straight to what needs fixing.
      boxes[firstWrong].current.focus();
      return;
    }
    setSending(true);
    setServerError(null);
    try {
      await sendEnquiry(slug, {
        name: values.name.trim(), email: values.email.trim(), message: values.message.trim(),
      });
      setSentBy(values.name.trim());
      setFocusNext('thanks');
    } catch (err) {
      // The API gives { box: ['text'] }; show the first sentence per box.
      const fields = Object.fromEntries(
        Object.entries(err.fields ?? {})
          .filter(([box]) => ORDER.includes(box))
          .map(([box, list]) => [box, Array.isArray(list) ? list[0] : String(list)]),
      );
      setServerError({ fields, message: err.message });
      const firstWrong = ORDER.find((box) => fields[box]);
      if (firstWrong) boxes[firstWrong].current.focus();
      else setFocusNext('problem');
    } finally {
      setSending(false);
    }
  };

  const again = () => {
    setValues(EMPTY);
    setTried(false);
    setSentBy(null);
    setServerError(null);
    setFocusNext('name');
  };

  const headingId = `${id}-heading`;

  if (sentBy !== null) {
    return (
      <section className="enquiry" aria-labelledby={headingId}>
        <h2 id={headingId}>Ask {gymName}</h2>
        {/* tabIndex -1 lets us move focus here so the thank-you is read out. */}
        <div className="notice" role="status" tabIndex={-1} ref={thanksRef}>
          {/* React writes this as text, so a name like <img ...> cannot run as HTML. */}
          <p>Thanks, {sentBy}. Your message was sent to {gymName}.</p>
          <button type="button" onClick={again}>
            Send another
          </button>
        </div>
      </section>
    );
  }

  // Props shared by every box: label link, error state, error text link.
  const boxProps = (box, hintId) => ({
    id: `${id}-${box}`,
    name: box,
    value: values[box],
    onChange: change,
    ref: boxes[box],
    'aria-invalid': Boolean(errors[box]),
    'aria-describedby': [hintId, errors[box] && `${id}-${box}-error`].filter(Boolean).join(' ') || undefined,
  });

  const errorText = (box) =>
    errors[box] && (
      <p className="hint hint-error" id={`${id}-${box}-error`}>
        {errors[box]}
      </p>
    );

  return (
    <section className="enquiry" aria-labelledby={headingId}>
      <h2 id={headingId}>Ask {gymName}</h2>
      {serverError?.message && (
        <div className="notice" role="alert" tabIndex={-1} ref={problemRef}>
          <p>{serverError.message}</p>
        </div>
      )}
      {/* noValidate: our own messages instead of the browser's, the same in every browser. */}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-name`}>Your name</label>
          <input type="text" autoComplete="name" {...boxProps('name')} />
          {errorText('name')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-email`}>Email</label>
          <input type="email" autoComplete="email" inputMode="email" {...boxProps('email')} />
          {errorText('email')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-message`}>Message</label>
          <p className="hint" id={`${id}-message-hint`}>
            At least {MESSAGE_MIN} characters.
          </p>
          <textarea rows={5} {...boxProps('message', `${id}-message-hint`)} />
          {errorText('message')}
        </div>
        <button type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Send enquiry'}
        </button>
      </form>
    </section>
  );
}
