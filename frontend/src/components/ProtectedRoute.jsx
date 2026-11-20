import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../AuthContext.jsx';

// Wraps a page that needs a login:
//   <ProtectedRoute role="owner"><Dashboard /></ProtectedRoute>
//
// 1. While AuthContext is still asking "who am I?", show a short message.
//    Redirecting now would bounce a logged-in person to /login on every reload.
// 2. Logged out: go to /login and remember where they were headed (state.from),
//    so the login page can send them back afterwards. `replace` keeps the
//    Back button from returning to the page they were refused.
// 3. Logged in but the wrong role: say so. A redirect would hide the reason.
//
// This only decides what the browser shows. The server still checks every
// request (the real lock), so editing this file in dev tools gains nothing.
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="page">
        <p role="status">Checking your login…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (role && user.role !== role) {
    return (
      <main className="page">
        <title>Not allowed | Nairobi gyms</title>
        <div className="notice">
          <h1>This page is for {role === 'owner' ? 'gym owners' : `${role}s`}</h1>
          <p>Your account is a {user.role} account.</p>
          <Link className="back-link" to="/">← Back to search</Link>
        </div>
      </main>
    );
  }

  return children;
}
