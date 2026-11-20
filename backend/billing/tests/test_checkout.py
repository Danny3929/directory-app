"""POST /billing/checkout/ and GET /billing/history/. Stripe itself is replaced by a fake."""
from types import SimpleNamespace

import pytest
import stripe

from billing.models import BoostPurchase
from listings.models import Listing
from listings.tests.test_api_my_listings import GYM, URL, login

pytestmark = pytest.mark.django_db
CHECKOUT = "/api/v1/billing/checkout/"
HISTORY = "/api/v1/billing/history/"


@pytest.fixture(autouse=True)
def fake_stripe(settings, monkeypatch):
    """Every test gets a test key and a fake Stripe that records what it was asked."""
    settings.STRIPE_SECRET_KEY = "sk_test_fake"  # allow-commit-check (not a real key)
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(id=f"cs_test_{len(calls)}", url="https://checkout.stripe.com/c/pay/x")

    monkeypatch.setattr(stripe.checkout.Session, "create", create)
    return calls


def owner_with_gym(email="a@example.com", published=True):
    client = login(email)
    gid = client.post(URL, GYM, format="json").data["id"]
    Listing.objects.filter(pk=gid).update(is_published=published)
    return client, gid


def test_owner_gets_a_stripe_url_and_a_pending_boost(fake_stripe):
    client, gid = owner_with_gym()
    resp = client.post(CHECKOUT, {"listing_id": gid}, format="json")
    assert resp.status_code == 201
    assert resp.data["url"].startswith("https://checkout.stripe.com/")
    sent = fake_stripe[0]
    assert sent["mode"] == "payment"
    assert sent["metadata"]["listing_id"] == str(gid)
    assert sent["line_items"][0]["price_data"]["unit_amount"] == 50000
    boost = BoostPurchase.objects.get()
    assert boost.status == "pending" and boost.listing_id == gid
    # Starting a checkout must never feature the gym: only the webhook may.
    assert Listing.objects.get(pk=gid).featured_until is None


def test_another_owners_gym_is_404_and_stripe_is_never_called(fake_stripe):
    _, gid = owner_with_gym("a@example.com")
    b = login("b@example.com")
    assert b.post(CHECKOUT, {"listing_id": gid}, format="json").status_code == 404
    assert fake_stripe == [] and not BoostPurchase.objects.exists()


def test_price_comes_from_the_server_not_the_request(fake_stripe):
    client, gid = owner_with_gym()
    client.post(CHECKOUT, {"listing_id": gid, "amount": 1, "unit_amount": 1, "days": 365}, format="json")
    assert fake_stripe[0]["line_items"][0]["price_data"]["unit_amount"] == 50000
    assert BoostPurchase.objects.get().days == 30


@pytest.mark.parametrize("role", [None, "visitor"])
def test_anonymous_and_visitors_cannot_checkout(role):
    from rest_framework.test import APIClient
    client = APIClient() if role is None else login("v@example.com", role=role)
    assert client.post(CHECKOUT, {"listing_id": 1}, format="json").status_code in (401, 403)


@pytest.mark.parametrize("body", [{}, {"listing_id": "abc"}, {"listing_id": -1}])
def test_bad_listing_id_is_400(body):
    client = login()
    assert client.post(CHECKOUT, body, format="json").status_code == 400


def test_unpublished_gym_cannot_be_boosted(fake_stripe):
    client, gid = owner_with_gym(published=False)
    resp = client.post(CHECKOUT, {"listing_id": gid}, format="json")
    assert resp.status_code == 400 and resp.data["error"]["code"] == "not_published"
    assert fake_stripe == []


def test_no_stripe_key_gives_503(settings):
    client, gid = owner_with_gym()
    settings.STRIPE_SECRET_KEY = ""
    resp = client.post(CHECKOUT, {"listing_id": gid}, format="json")
    assert resp.status_code == 503 and resp.data["error"]["code"] == "billing_unavailable"


def test_stripe_down_gives_503_without_leaking_the_error(monkeypatch):
    client, gid = owner_with_gym()

    def broken(**kwargs):
        raise stripe.APIConnectionError("secret internal detail")

    monkeypatch.setattr(stripe.checkout.Session, "create", broken)
    resp = client.post(CHECKOUT, {"listing_id": gid}, format="json")
    assert resp.status_code == 503
    assert "secret internal detail" not in resp.content.decode()
    assert not BoostPurchase.objects.exists()


def test_owner_cannot_feature_a_gym_by_editing_it():
    """The free way round paying: PATCH featured_until on my own gym. It must be ignored."""
    client, gid = owner_with_gym()
    resp = client.patch(f"{URL}{gid}/", {"featured_until": "2999-01-01T00:00:00Z"}, format="json")
    assert resp.status_code == 200 and resp.data["featured_until"] is None
    assert Listing.objects.get(pk=gid).featured_until is None


def test_history_shows_only_my_boosts():
    a, gid_a = owner_with_gym("a@example.com")
    b, gid_b = owner_with_gym("b@example.com")
    a.post(CHECKOUT, {"listing_id": gid_a}, format="json")
    b.post(CHECKOUT, {"listing_id": gid_b}, format="json")
    resp = a.get(HISTORY)
    assert resp.status_code == 200
    assert [row["listing"] for row in resp.data["results"]] == [gid_a]
