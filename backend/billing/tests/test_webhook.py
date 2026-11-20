"""POST /billing/webhook/: the only place a boost is applied.

Each test signs its body the way Stripe does (HMAC-SHA256 of "timestamp.body"
with the endpoint secret), so the real stripe.Webhook.construct_event runs.
"""
import hashlib
import hmac
import json
import time
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from billing.models import BoostPurchase, ProcessedStripeEvent
from listings.models import Listing
from listings.tests.test_api_my_listings import GYM, URL, login

pytestmark = pytest.mark.django_db
HOOK = "/api/v1/billing/webhook/"
SECRET = "whsec_test_fake"  # allow-commit-check (not a real secret)


@pytest.fixture(autouse=True)
def webhook_secret(settings):
    settings.STRIPE_WEBHOOK_SECRET = SECRET


def sign(body, secret=SECRET, at=None):
    at = int(at or time.time())
    mac = hmac.new(secret.encode(), f"{at}.{body}".encode(), hashlib.sha256).hexdigest()
    return f"t={at},v1={mac}"


def send(event, secret=SECRET, at=None, signature=None):
    body = json.dumps(event)
    header = signature if signature is not None else sign(body, secret, at)
    # A plain client with CSRF checks on, like Stripe's servers (no cookies, no token).
    return Client(enforce_csrf_checks=True).post(
        HOOK, body, content_type="application/json", HTTP_STRIPE_SIGNATURE=header
    )


def pending_boost(email="a@example.com", session_id="cs_test_1"):
    client = login(email)
    gid = client.post(URL, GYM, format="json").data["id"]
    listing = Listing.objects.get(pk=gid)
    listing.is_published = True
    listing.save()
    boost = BoostPurchase.objects.create(
        owner=listing.owner, listing=listing, listing_name=listing.name,
        amount_ksh=500, days=30, stripe_session_id=session_id,
    )
    return listing, boost


def paid_event(boost, event_id="evt_1", listing_id=None, payment_status="paid"):
    return {
        "id": event_id, "object": "event", "type": "checkout.session.completed",
        "data": {"object": {
            "id": boost.stripe_session_id, "object": "checkout.session",
            "payment_status": payment_status,
            "metadata": {"listing_id": str(listing_id or boost.listing_id)},
        }},
    }


def test_good_event_features_the_gym_for_30_days():
    listing, boost = pending_boost()
    before = timezone.now()
    assert send(paid_event(boost)).status_code == 200
    listing.refresh_from_db()
    boost.refresh_from_db()
    assert listing.is_featured
    assert timedelta(days=29, hours=23) < listing.featured_until - before <= timedelta(days=30, minutes=1)
    assert boost.status == "paid" and boost.featured_until == listing.featured_until


def test_bad_signature_is_400_and_changes_nothing():
    listing, boost = pending_boost()
    assert send(paid_event(boost), secret="whsec_attacker").status_code == 400  # allow-commit-check
    assert send(paid_event(boost), signature="").status_code == 400
    assert send(paid_event(boost), signature="t=1,v1=deadbeef").status_code == 400
    listing.refresh_from_db()
    assert listing.featured_until is None
    assert not ProcessedStripeEvent.objects.exists()


def test_old_signature_is_rejected():
    """A captured request replayed later fails: Stripe's tolerance is 5 minutes."""
    listing, boost = pending_boost()
    assert send(paid_event(boost), at=time.time() - 3600).status_code == 400
    listing.refresh_from_db()
    assert listing.featured_until is None


def test_replayed_event_is_applied_once():
    listing, boost = pending_boost()
    event = paid_event(boost)
    assert send(event).status_code == 200
    listing.refresh_from_db()
    first = listing.featured_until
    # Stripe retries the same event: still 200 (so it stops retrying), but no extra days.
    assert send(event).status_code == 200
    listing.refresh_from_db()
    assert listing.featured_until == first
    assert ProcessedStripeEvent.objects.filter(event_id="evt_1").count() == 1


def test_second_boost_extends_from_the_current_end_date():
    listing, boost = pending_boost()
    end = timezone.now() + timedelta(days=10)
    Listing.objects.filter(pk=listing.pk).update(featured_until=end)
    send(paid_event(boost))
    listing.refresh_from_db()
    assert listing.featured_until == end + timedelta(days=30)


def test_metadata_for_another_owners_gym_does_nothing():
    """A paid session whose metadata names someone else's gym must not boost that gym."""
    _, boost = pending_boost("a@example.com", "cs_test_a")
    other, _ = pending_boost("b@example.com", "cs_test_b")
    assert send(paid_event(boost, listing_id=other.id)).status_code == 200
    other.refresh_from_db()
    boost.refresh_from_db()
    assert other.featured_until is None and boost.status == "pending"


def test_unpaid_session_and_unknown_session_do_nothing():
    listing, boost = pending_boost()
    send(paid_event(boost, payment_status="unpaid"))
    stranger = BoostPurchase(stripe_session_id="cs_never_started", listing_id=listing.id)
    send(paid_event(stranger, event_id="evt_2"))
    listing.refresh_from_db()
    assert listing.featured_until is None


def test_other_event_types_are_recorded_and_ignored():
    pending_boost()
    event = {"id": "evt_9", "object": "event", "type": "payment_intent.created", "data": {"object": {}}}
    assert send(event).status_code == 200
    assert ProcessedStripeEvent.objects.filter(event_id="evt_9").exists()


def test_no_webhook_secret_gives_503(settings):
    _, boost = pending_boost()
    settings.STRIPE_WEBHOOK_SECRET = ""
    assert send(paid_event(boost)).status_code == 503


def test_get_is_not_allowed():
    assert Client().get(HOOK).status_code == 405
