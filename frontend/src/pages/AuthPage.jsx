import { useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../AuthContext.jsx';
import { loginErrors, registerErrors, safeFrom, PASSWORD_MIN } from '../lib/account.js';

// One page for both forms: mode is 'login' or 'register'.
// Same pattern as the enquiry form: our checks first (after the first submit),
// then the server's answer, which is the one that counts.
const FIELDS = { login: ['email', 'password'], register: ['email', 'password', 'role'] };

export default function AuthPage({ mode }) {
  const id = useId();
  const { user, login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isRegister = mode === 'register';
  const order = FIELDS[mode];
  const check = isRegister ? registerErrors : loginErrors;

  const [values, setValues] = useState({ email: '', password: '', role: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null); // { fields, message }
  const boxes = { email: useRef(null), password: useRef(null), role: useRef(null) };

  const errors = { ...(tried ? check(values) : {}), ...(serverError?.fields ?? {}) };

  const from = safeFrom(location.state?.from);
  // Already logged in (or just became so): go where they were headed.
  if (user) return <Navigate to={from} replace />;

  const change = (event) => {
    const { name, value } = event.target;
    setValues((v) => ({ ...v, [name]: value }));
    setServerError((e) => e && { ...e, fields: { ...e.fields, [name]: undefined } });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const found = check(values);
    const firstWrong = order.find((box) => found[box]);
    if (firstWrong) {
      setTried(true);
      boxes[firstWrong].current.focus();
      return;
    }
    setBusy(true);
    setServerError(null);
    const credentials = { email: values.email.trim(), password: values.password };
    try {
      if (isRegister) await register({ ...credentials, role: values.role });
      await login(credentials); // sets the user; the Navigate above then takes over
      navigate(from, { replace: true });
    } catch (err) {
      const fields = Object.fromEntries(
        Object.entries(err.fields ?? {})
          .filter(([box]) => order.includes(box))
          .map(([box, list]) => [box, Array.isArray(list) ? list[0] : String(list)]),
      );
      setServerError({ fields, message: err.message });
      const firstWrong = order.find((box) => fields[box]);
      if (firstWrong) boxes[firstWrong].current.focus();
    } finally {
      setBusy(false);
    }
  };

  const props = (box, hintId) => ({
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
      <p className="hint hint-error" id={`${id}-${box}-error`}>{errors[box]}</p>
    );

  const title = isRegister ? 'Create an account' : 'Log in';
  // Fields the server complained about are shown under the boxes, so the banner
  // only appears for a general problem (wrong password, no network).
  const showBanner = serverError?.message && !Object.values(serverError.fields).some(Boolean);

  return (
    <main className="page auth">
      <title>{`${title} | Nairobi gyms`}</title>
      <h1>{title}</h1>
      {showBanner && (
        <div className="notice notice-error" role="alert" tabIndex={-1} ref={(el) => el?.focus()}>
          <p>{serverError.message}</p>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-email`}>Email</label>
          <input type="email" autoComplete="email" inputMode="email" {...props('email')} />
          {errorText('email')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-password`}>Password</label>
          {isRegister && <p className="hint" id={`${id}-password-hint`}>At least {PASSWORD_MIN} characters.</p>}
          <input
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            {...props('password', isRegister ? `${id}-password-hint` : undefined)}
          />
          {errorText('password')}
        </div>
        {isRegister && (
          <div className="field">
            <label htmlFor={`${id}-role`}>I want to</label>
            <select {...props('role')}>
              <option value="">Choose…</option>
              <option value="visitor">Find a gym</option>
              <option value="owner">List my gym</option>
            </select>
            {errorText('role')}
          </div>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : title}
        </button>
      </form>
      <p>
        {isRegister ? (
          <>Already have an account? <Link to="/login" state={location.state}>Log in</Link></>
        ) : (
          <>New here? <Link to="/register" state={location.state}>Create an account</Link></>
        )}
      </p>
    </main>
  );
}
