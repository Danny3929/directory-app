import { useEffect, useId, useRef, useState } from 'react';
import { enquiryErrors, MESSAGE_MIN } from '../lib/enquiry.js';

const EMPTY = { name: '', email: '', message: '' };
const ORDER = ['name', 'email', 'message'];

// The enquiry form on the detail page. UI only for now: nothing is sent.
// Task 3 posts it to Django, which must check everything again.
export default function EnquiryForm({ gymName }) {
  const id = useId();
  const [values, setValues] = useState(EMPTY);
  // Errors only show after the first Send, so nobody is told off mid-typing.
  const [tried, setTried] = useState(false);
  const [sentBy, setSentBy] = useState(null);
  const boxes = { name: useRef(null), email: useRef(null), message: useRef(null) };
  const thanksRef = useRef(null);
  // What to focus after the screen changes: 'thanks' or 'name'.
  const [focusNext, setFocusNext] = useState(null);

  const errors = tried ? enquiryErrors(values) : {};

  useEffect(() => {
    if (focusNext === 'thanks') thanksRef.current?.focus();
    if (focusNext === 'name') boxes.name.current?.focus();
    if (focusNext) setFocusNext(null);
    // boxes are refs, they never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNext]);

  const change = (event) => setValues((v) => ({ ...v, [event.target.name]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    const found = enquiryErrors(values);
    const firstWrong = ORDER.find((box) => found[box]);
    if (firstWrong) {
      setTried(true);
      // Take keyboard and screen-reader users straight to what needs fixing.
      boxes[firstWrong].current.focus();
      return;
    }
    setSentBy(values.name.trim());
    setFocusNext('thanks');
  };

  const again = () => {
    setValues(EMPTY);
    setTried(false);
    setSentBy(null);
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
          <p>Thanks, {sentBy}. This is a demo, so nothing was sent yet.</p>
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
      <p className="muted">This form is a demo: nothing is sent yet.</p>
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
        <button type="submit">Send enquiry</button>
      </form>
    </section>
  );
}
