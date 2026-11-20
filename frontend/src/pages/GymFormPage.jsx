import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { createMyGym, getMyGym, listTags, updateMyGym } from '../api/owner.js';
import { EMPTY_GYM, fromGym, gymErrors, toPayload } from '../lib/gymForm.js';

// Create (/dashboard/new) and edit (/dashboard/:id/edit) share this form.
// Same pattern as the other forms: our checks after the first submit, then the
// server's answer, which is the one that counts.
const ORDER = ['name', 'description', 'address', 'area', 'city', 'zip_code', 'latitude', 'longitude', 'price_min', 'price_max'];
const TEXT_BOXES = [
  ['address', 'Street address'], ['area', 'Area (optional)'], ['city', 'City'], ['zip_code', 'ZIP code'],
];
const NUMBER_BOXES = [
  ['latitude', 'Latitude', 'any'], ['longitude', 'Longitude', 'any'],
  ['price_min', 'Lowest monthly price (KSh)', '1'], ['price_max', 'Highest monthly price (KSh)', '1'],
];

export default function GymFormPage() {
  const { id } = useParams(); // undefined when creating
  const editing = id !== undefined;
  const formId = useId();
  const navigate = useNavigate();

  const [load, setLoad] = useState({ status: editing ? 'loading' : 'ready', error: '' });
  const [tags, setTags] = useState([]);
  const [values, setValues] = useState(EMPTY_GYM);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null); // { fields, message }
  const boxes = useRef({});

  useEffect(() => {
    let cancelled = false;
    listTags().then((list) => !cancelled && setTags(list)).catch(() => {}); // no tag list: the form still works
    if (editing) {
      getMyGym(id)
        .then((gym) => { if (!cancelled) { setValues(fromGym(gym)); setLoad({ status: 'ready', error: '' }); } })
        .catch((err) => !cancelled && setLoad({ status: 'error', error: err.status === 404 ? 'That gym was not found.' : err.message }));
    }
    return () => { cancelled = true; };
  }, [id, editing]);

  const errors = { ...(tried ? gymErrors(values) : {}), ...(serverError?.fields ?? {}) };

  const change = (event) => {
    const { name, value } = event.target;
    setValues((v) => ({ ...v, [name]: value }));
    setServerError((e) => e && { ...e, fields: { ...e.fields, [name]: undefined } });
  };
  const toggleTag = (slug) =>
    setValues((v) => ({ ...v, tags: v.tags.includes(slug) ? v.tags.filter((t) => t !== slug) : [...v.tags, slug] }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const found = gymErrors(values);
    const firstWrong = ORDER.find((box) => found[box]);
    if (firstWrong) {
      setTried(true);
      boxes.current[firstWrong]?.focus();
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      if (editing) await updateMyGym(id, toPayload(values));
      else await createMyGym(toPayload(values));
      navigate('/dashboard');
    } catch (err) {
      const fields = Object.fromEntries(
        Object.entries(err.fields ?? {})
          .filter(([box]) => ORDER.includes(box) || box === 'tags')
          .map(([box, list]) => [box, Array.isArray(list) ? list[0] : String(list)]),
      );
      setServerError({ fields, message: err.message });
      const firstWrong = ORDER.find((box) => fields[box]);
      if (firstWrong) boxes.current[firstWrong]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const errorText = (box) =>
    errors[box] && <p className="hint hint-error" id={`${formId}-${box}-error`}>{errors[box]}</p>;
  const props = (box) => ({
    id: `${formId}-${box}`,
    name: box,
    value: values[box],
    onChange: change,
    ref: (el) => { boxes.current[box] = el; },
    'aria-invalid': Boolean(errors[box]),
    'aria-describedby': errors[box] ? `${formId}-${box}-error` : undefined,
  });
  const textField = ([box, label]) => (
    <div className="field" key={box}>
      <label htmlFor={`${formId}-${box}`}>{label}</label>
      <input type="text" {...props(box)} />
      {errorText(box)}
    </div>
  );

  const title = editing ? 'Edit gym' : 'Add a gym';
  const showBanner = serverError?.message && !Object.values(serverError.fields).some(Boolean);

  if (load.status === 'loading') {
    return <main className="page"><p role="status">Loading your gym…</p></main>;
  }
  if (load.status === 'error') {
    return (
      <main className="page">
        <Link className="back-link" to="/dashboard">← Back to my gyms</Link>
        <div className="notice notice-error" role="alert"><p>{load.error}</p></div>
      </main>
    );
  }

  return (
    <main className="page auth">
      <title>{`${title} | Nairobi gyms`}</title>
      <Link className="back-link" to="/dashboard">← Back to my gyms</Link>
      <h1>{title}</h1>
      {!editing && <p>New gyms are reviewed by an admin before they appear in search.</p>}
      {showBanner && (
        <div className="notice notice-error" role="alert" tabIndex={-1} ref={(el) => el?.focus()}>
          <p>{serverError.message}</p>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        {textField(['name', 'Gym name'])}
        <div className="field">
          <label htmlFor={`${formId}-description`}>Description</label>
          <textarea rows={5} {...props('description')} />
          {errorText('description')}
        </div>
        {TEXT_BOXES.map(textField)}
        {NUMBER_BOXES.map(([box, label, step]) => (
          <div className="field" key={box}>
            <label htmlFor={`${formId}-${box}`}>{label}</label>
            <input type="number" inputMode="decimal" step={step} {...props(box)} />
            {errorText(box)}
          </div>
        ))}
        {tags.length > 0 && (
          <fieldset className="field">
            <legend>Tags</legend>
            {tags.map((tag) => (
              <label key={tag.slug} className="check">
                <input type="checkbox" checked={values.tags.includes(tag.slug)} onChange={() => toggleTag(tag.slug)} />
                {tag.name}
              </label>
            ))}
            {errorText('tags')}
          </fieldset>
        )}
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save gym'}</button>
      </form>
    </main>
  );
}
