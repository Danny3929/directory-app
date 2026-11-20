import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listEnquiries, markEnquiryRead } from '../api/owner.js';
import { unreadChanged } from '../lib/unread.js';

// The owner's inbox: messages sent to their gyms, newest first, 12 per page.
// Unread ones say "Unread" in words (not only bold). Marking one read asks the
// server first, and only then changes the screen.
export default function EnquiriesPage() {
  const [state, setState] = useState({ status: 'loading', items: [], next: null, page: 0, error: '' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState({}); // id -> message when marking read failed

  const loadPage = async (page) => {
    const data = await listEnquiries(page);
    setState((s) => ({ status: 'ready', items: [...s.items, ...data.results], next: data.next, page, error: '' }));
  };

  useEffect(() => {
    let cancelled = false;
    listEnquiries(1)
      .then((data) => !cancelled && setState({ status: 'ready', items: data.results, next: data.next, page: 1, error: '' }))
      .catch((err) => !cancelled && setState({ status: 'error', items: [], next: null, page: 0, error: err.message }));
    return () => { cancelled = true; };
  }, []);

  const more = async () => {
    setLoadingMore(true);
    try { await loadPage(state.page + 1); } catch (err) { setState((s) => ({ ...s, error: err.message })); } finally { setLoadingMore(false); }
  };

  const markRead = async (id) => {
    setFailed((f) => ({ ...f, [id]: undefined }));
    try {
      await markEnquiryRead(id);
      setState((s) => ({ ...s, items: s.items.map((e) => (e.id === id ? { ...e, is_read: true } : e)) }));
      unreadChanged();
    } catch (err) {
      setFailed((f) => ({ ...f, [id]: err.message }));
    }
  };

  const unread = state.items.filter((e) => !e.is_read).length;

  return (
    <main className="page">
      <title>Enquiries | Nairobi gyms</title>
      <Link className="back-link" to="/dashboard">← Back to my gyms</Link>
      <h1>Enquiries</h1>
      {state.status === 'loading' && <p role="status">Loading your enquiries…</p>}
      {state.status === 'error' && (
        <div className="notice notice-error" role="alert">
          <p>{state.error}</p>
          <Link to="/dashboard/enquiries" reloadDocument>Try again</Link>
        </div>
      )}
      {state.status === 'ready' && state.items.length === 0 && <p>No enquiries yet. Messages sent to your gyms will appear here.</p>}
      {state.status === 'ready' && state.items.length > 0 && (
        <>
          <p role="status">{unread === 0 ? 'Everything shown is read.' : `${unread} unread shown.`}</p>
          <ul className="enquiry-list">
            {state.items.map((e) => (
              <li key={e.id} className={e.is_read ? 'enquiry' : 'enquiry enquiry-unread'}>
                <p className="enquiry-head">
                  <strong>{e.listing_name}</strong>
                  {' · '}
                  <span>{e.is_read ? 'Read' : 'Unread'}</span>
                  {' · '}
                  <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                </p>
                <p>From {e.name} (<a href={`mailto:${e.email}`}>{e.email}</a>)</p>
                <p className="enquiry-message">{e.message}</p>
                {!e.is_read && (
                  <button type="button" onClick={() => markRead(e.id)} aria-label={`Mark the message from ${e.name} as read`}>Mark as read</button>
                )}
                {failed[e.id] && <p className="hint hint-error" role="alert">{failed[e.id]}</p>}
              </li>
            ))}
          </ul>
          {state.error && <div className="notice notice-error" role="alert"><p>{state.error}</p></div>}
          {state.next && <button type="button" onClick={more} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>}
        </>
      )}
    </main>
  );
}
