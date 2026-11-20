"""The two money rules, kept apart from the views so tests can call them directly.

1. start_checkout: ask Stripe for a payment page. Nothing is boosted here.
2. handle_event: the only place a boost is applied, and only for a verified,
   never-seen-before Stripe event.
"""
import logging
from datetime import timedelta

import stripe
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from listings.models import Listing

from .models import BoostPurchase, ProcessedStripeEvent

logger = logging.getLogger(__name__)


class BillingUnavailable(Exception):
    """Stripe is not set up on this server, or Stripe could not be reached."""


def start_checkout(owner, listing):
    """Create a Stripe Checkout Session for one boost and a pending BoostPurchase.

    The caller has already checked that `owner` owns `listing`."""
    if not settings.STRIPE_SECRET_KEY:
        raise BillingUnavailable("Stripe is not set up on this server.")
    try:
        session = stripe.checkout.Session.create(
            api_key=settings.STRIPE_SECRET_KEY,
            mode="payment",
            line_items=[{
                "quantity": 1,
                "price_data": {
                    "currency": "kes",
                    # Stripe counts in cents: Ksh 500 is 50000.
                    "unit_amount": settings.BOOST_PRICE_KSH * 100,
                    "product_data": {"name": f"Boost {listing.name} for {settings.BOOST_DAYS} days"},
                },
            }],
            # The webhook reads these back to know which gym was paid for.
            metadata={"listing_id": str(listing.id), "owner_id": str(owner.id)},
            client_reference_id=str(listing.id),
            success_url=f"{settings.FRONTEND_URL}/dashboard/boost/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/dashboard/boost/cancelled",
        )
    except stripe.StripeError:
        logger.exception("Stripe checkout failed for listing %s", listing.id)
        raise BillingUnavailable("Stripe could not be reached. Please try again.")

    BoostPurchase.objects.create(
        owner=owner,
        listing=listing,
        listing_name=listing.name,
        amount_ksh=settings.BOOST_PRICE_KSH,
        days=settings.BOOST_DAYS,
        stripe_session_id=session.id,
    )
    return session.url


def handle_event(event):
    """Apply one verified Stripe event (a plain dict). Returns a short word for the log.

    Everything runs in one transaction: the event id is saved first, so if the
    same event arrives again (Stripe retries), the unique id makes the insert
    fail and nothing is applied twice."""
    try:
        with transaction.atomic():
            ProcessedStripeEvent.objects.create(event_id=event["id"], type=event["type"])
            if event["type"] != "checkout.session.completed":
                return "ignored"
            return _apply_boost(event["data"]["object"])
    except IntegrityError:
        return "duplicate"


def _apply_boost(session):
    if session.get("payment_status") != "paid":
        return "not_paid"
    boost = (
        BoostPurchase.objects.select_for_update()
        .filter(stripe_session_id=session["id"]).first()
    )
    if boost is None or boost.status == BoostPurchase.Status.PAID:
        logger.warning("Paid session %s has no pending boost", session["id"])
        return "unknown_session"
    # The metadata must agree with what we saved when the checkout started.
    if str(boost.listing_id) != (session.get("metadata") or {}).get("listing_id"):
        logger.warning("Session %s metadata does not match its boost", session["id"])
        return "mismatch"

    listing = Listing.objects.select_for_update().get(pk=boost.listing_id)
    now = timezone.now()
    # Extend from today, or from the current end date if it is still featured.
    start = listing.featured_until if listing.is_featured else now
    listing.featured_until = start + timedelta(days=boost.days)
    listing.save(update_fields=["featured_until", "updated_at"])

    boost.status = BoostPurchase.Status.PAID
    boost.paid_at = now
    boost.featured_until = listing.featured_until
    boost.save(update_fields=["status", "paid_at", "featured_until"])
    return "boosted"
