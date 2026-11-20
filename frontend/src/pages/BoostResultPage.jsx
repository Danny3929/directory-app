import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listBoosts } from '../api/billing.js';

const TRIES = 10;
const WAIT_MS = 3000;
const dateText = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Where Stripe sends the owner back. Anyone can type this address, so it
// proves nothing: it never boosts a gym. The success version only ASKS the
// server whether Stripe's webhook has confirmed this payment yet.
export default function BoostResultPage({ outcome }) {
  return outcome === 'success' ? <Success /> : <Cancelled />;
}

function Cancelled() {
  return (
    <main className="page">
      <title>Boost cancelled | Nairobi gyms</title>
      <h1>Boost cancelled</h1>
      <p>No payment was taken and your gym is unchanged.</p>
      <p className="dash-links"><Link to="/dashboard">Back to my gyms</Link></p>
    </main>
  );
}

function Success() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  // waiting -> paid, or waiting -> slow (gave up asking), or error
  const [state, setState] = useState({ status: sessionId ? 'waiting' : 'unknown', boost: null, error: '' });

  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    let timer;
    const check = async (tryNumber) => {
      try {
        const data = await listBoosts(1);
        if (cancelled) return;
        const boost = data.results.find((b) => b.stripe_session_id === sessionId);
        if (boost?.status === 'paid') return setState({ status: 'paid', boost, error: '' });
        if (tryNumber >= TRIES) return setState({ status: 'slow', boost, error: '' });
        timer = setTimeout(() => check(tryNumber + 1), WAIT_MS);
      } catch (err) {
        if (!cancelled) setState({ status: 'error', boost: null, error: err.message });
      }
    };
    check(1);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);

  return (
    <main className="page">
      <title>Boost payment | Nairobi gyms</title>
      <h1>Boost payment</h1>
      {/* One live region, so a screen reader hears each change of state. */}
      <div role="status">
        {state.status === 'waiting' && <p>Waiting for Stripe to confirm your payment…</p>}
        {state.status === 'paid' && (
          <p>Confirmed. <strong>{state.boost.listing_name}</strong> is featured until {dateText(state.boost.featured_until)}.</p>
        )}
        {state.status === 'slow' && (
          <p>Stripe has not confirmed this payment yet. It can take a few minutes. Your gym is featured as soon as it does; check your billing history later.</p>
        )}
        {state.status === 'unknown' && <p>This page has no payment to look up. Check your billing history instead.</p>}
      </div>
      {state.status === 'error' && <div className="notice notice-error" role="alert"><p>{state.error}</p></div>}
      <p className="dash-links">
        <Link to="/dashboard">Back to my gyms</Link>
        {' · '}
        <Link to="/dashboard/billing">Billing history</Link>
      </p>
    </main>
  );
}
