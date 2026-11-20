import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { deleteMyGym, listMyGyms } from '../api/owner.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

// The owner's list of their own gyms, with Published or Pending status.
// Routing wraps this in <ProtectedRoute role="owner">; the server checks again.
export default function DashboardPage() {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState({ status: 'loading', gyms: [], error: '' });
  const [asking, setAsking] = useState(null); // the gym the delete box is about
  const [deleting, setDeleting] = useState(false);
  const [banner, setBanner] = useState('');

  useEffect(() => {
    let cancelled = false;
    listMyGyms()
      .then((gyms) => !cancelled && setData({ status: 'ready', gyms, error: '' }))
      .catch((err) => !cancelled && setData({ status: 'error', gyms: [], error: err.message }));
    return () => { cancelled = true; };
  }, [attempt]);

  const retry = () => {
    setData((old) => ({ ...old, status: 'loading' }));
    setAttempt((n) => n + 1);
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteMyGym(asking.id);
      setData((old) => ({ ...old, gyms: old.gyms.filter((g) => g.id !== asking.id) }));
      setBanner('');
    } catch (err) {
      // e.g. 409: the gym has enquiries and cannot be deleted
      setBanner(err.message);
    } finally {
      setDeleting(false);
      setAsking(null);
    }
  };

  return (
    <main className="page">
      <title>My gyms | Nairobi gyms</title>
      <h1>My gyms</h1>
      <p><Link to="/dashboard/new">Add a gym</Link></p>

      {banner && <div className="notice notice-error" role="alert"><p>{banner}</p></div>}

      {data.status === 'loading' && <p role="status">Loading your gyms…</p>}
      {data.status === 'error' && (
        <div className="notice notice-error" role="alert">
          <p>{data.error}</p>
          <button type="button" onClick={retry}>Try again</button>
        </div>
      )}
      {data.status === 'ready' && data.gyms.length === 0 && (
        <div className="notice"><p>You have no gyms yet. Add one and an admin will review it.</p></div>
      )}
      {data.status === 'ready' && data.gyms.length > 0 && (
        <div className="table-wrap">
          <table className="dash-table">
            <caption className="sr-only">Your gyms</caption>
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Area</th><th scope="col">Status</th><th scope="col">Actions</th></tr>
            </thead>
            <tbody>
              {data.gyms.map((gym) => (
                <tr key={gym.id}>
                  <th scope="row">{gym.name}</th>
                  <td>{gym.area}</td>
                  {/* Words, not only colour, say which state it is in. */}
                  <td>{gym.is_published ? 'Published' : 'Pending approval'}</td>
                  <td>
                    <Link to={`/dashboard/${gym.id}/edit`} aria-label={`Edit ${gym.name}`}>Edit</Link>
                    {' '}
                    <button type="button" onClick={() => setAsking(gym)} aria-label={`Delete ${gym.name}`}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {asking && (
        <ConfirmDialog
          title={`Delete ${asking.name}?`}
          confirmLabel="Delete gym"
          busy={deleting}
          onConfirm={remove}
          onCancel={() => setAsking(null)}
        >
          <p>This removes the gym and its photos for good. It cannot be undone.</p>
        </ConfirmDialog>
      )}
    </main>
  );
}
