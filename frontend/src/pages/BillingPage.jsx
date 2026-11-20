import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listBoosts } from '../api/billing.js';

const dateText = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const STATUS = { paid: 'Paid', pending: 'Not confirmed' };

// The owner's boosts, newest first, 12 per page, with "Load more".
export default function BillingPage() {
  const [state, setState] = useState({ status: 'loading', items: [], next: null, page: 0, error: '' });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBoosts(1)
      .then((d) => !cancelled && setState({ status: 'ready', items: d.results, next: d.next, page: 1, error: '' }))
      .catch((err) => !cancelled && setState({ status: 'error', items: [], next: null, page: 0, error: err.message }));
    return () => { cancelled = true; };
  }, []);

  const more = async () => {
    setLoadingMore(true);
    try {
      const d = await listBoosts(state.page + 1);
      setState((s) => ({ ...s, items: [...s.items, ...d.results], next: d.next, page: s.page + 1, error: '' }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main className="page">
      <title>Billing history | Nairobi gyms</title>
      <Link className="back-link" to="/dashboard">← Back to my gyms</Link>
      <h1>Billing history</h1>
      {state.status === 'loading' && <p role="status">Loading your boosts…</p>}
      {state.error && (
        <div className="notice notice-error" role="alert">
          <p>{state.error}</p>
          {state.status === 'error' && <Link to="/dashboard/billing" reloadDocument>Try again</Link>}
        </div>
      )}
      {state.status === 'ready' && state.items.length === 0 && <p>No boosts yet. Boost a published gym from My gyms.</p>}
      {state.items.length > 0 && (
        <div className="table-wrap">
          <table className="dash-table">
            <caption className="sr-only">Your boosts</caption>
            <thead>
              <tr><th scope="col">Gym</th><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Featured until</th></tr>
            </thead>
            <tbody>
              {state.items.map((b) => (
                <tr key={b.id}>
                  <th scope="row">{b.listing_name}</th>
                  <td><time dateTime={b.created_at}>{dateText(b.created_at)}</time></td>
                  <td>Ksh {b.amount_ksh.toLocaleString('en-GB')}</td>
                  <td>{STATUS[b.status] ?? b.status}</td>
                  <td>{b.featured_until ? <time dateTime={b.featured_until}>{dateText(b.featured_until)}</time> : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state.next && (
        <div className="load-more">
          <button type="button" onClick={more} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>
        </div>
      )}
    </main>
  );
}
