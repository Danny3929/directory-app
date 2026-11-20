// Paying to boost a gym. The server picks the price and checks the gym is mine;
// this file only sends the gym id and follows Stripe's payment page link.
import { apiFetch } from './client.js';

// Gives back Stripe's payment page address. Nothing is boosted until Stripe
// tells the server (the webhook) that the payment really went through.
export const startBoost = (listingId) =>
  apiFetch('/billing/checkout/', { method: 'POST', body: { listing_id: listingId } }).then((d) => d.url);

// My boosts, newest first, 12 per page.
export const listBoosts = (page = 1) => apiFetch(`/billing/history/?page=${page}`);

// Kept apart so tests can replace it: leaving the site for Stripe's page.
export const goTo = (url) => window.location.assign(url);
