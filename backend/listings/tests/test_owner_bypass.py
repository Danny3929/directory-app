"""Step 5: three ways to get around the owner permission, each with a test.

Moss chose these three (Dan had no time to). Each one must fail.
"""
import pytest
from rest_framework.test import APIClient

from listings.models import Listing
from listings.tests.test_api_my_listings import GYM, URL, login

pytestmark = pytest.mark.django_db


def make_victim_gym():
    """Owner A with one gym, published so the public pages show it too."""
    a = login("a@example.com")
    gid = a.post(URL, GYM, format="json").data["id"]
    Listing.objects.filter(pk=gid).update(is_published=True)
    return a, gid


# Bypass 1: Owner B puts A's gym id in the URL and tries every method.
@pytest.mark.parametrize("method", ["get", "put", "patch", "delete"])
def test_bypass_1_other_owner_uses_my_gym_id(method):
    _, gid = make_victim_gym()
    b = login("b@example.com")
    body = {**GYM, "name": "Hacked"}
    resp = getattr(b, method)(f"{URL}{gid}/", **({} if method in ("get", "delete") else {"data": body, "format": "json"}))
    assert resp.status_code == 404
    gym = Listing.objects.get(pk=gid)  # still there, still A's, name untouched
    assert gym.name == "Sunrise Gym" and gym.owner.email == "a@example.com"


# Bypass 2: widen the list or take over a gym with extra values in the query or body.
def test_bypass_2_query_and_body_tricks_do_not_widen_access():
    a, gid = make_victim_gym()
    a_id = a.get("/api/v1/auth/me/").data["id"]
    b = login("b@example.com")
    b_id = b.get("/api/v1/auth/me/").data["id"]
    # Asking for A's gyms through the query string still shows only B's (none).
    for query in (f"?owner={a_id}", "?is_published=true", "?search=Sunrise", "?page_size=1000"):
        assert b.get(URL + query).json()["count"] == 0
    # B creates a gym claiming A as owner: it becomes B's, and A's gym is untouched.
    resp = b.post(URL, {**GYM, "name": "B Gym", "owner": a_id}, format="json")
    assert resp.status_code == 201
    assert Listing.objects.get(name="B Gym").owner_id == b_id
    # A cannot hand their gym to B through an edit either.
    a.patch(f"{URL}{gid}/", {"owner": b_id}, format="json")
    assert Listing.objects.get(pk=gid).owner_id == a_id


# Bypass 3: people who should not be on the owner endpoints at all.
def test_bypass_3_visitor_anonymous_and_public_urls_cannot_touch_it():
    _, gid = make_victim_gym()
    slug = Listing.objects.get(pk=gid).slug
    visitor = login("v@example.com", role="visitor")
    assert visitor.get(f"{URL}{gid}/").status_code == 403
    assert visitor.delete(f"{URL}{gid}/").status_code == 403
    anon = APIClient()
    assert anon.get(f"{URL}{gid}/").status_code == 401
    assert anon.delete(f"{URL}{gid}/").status_code == 401
    # The public URL for the same gym is read-only for everyone, even its owner.
    for client in (anon, visitor):
        assert client.patch(f"/api/v1/listings/{slug}/", {"name": "x"}, format="json").status_code in (401, 403, 405)
        assert client.delete(f"/api/v1/listings/{slug}/").status_code in (401, 403, 405)
    assert Listing.objects.filter(pk=gid, name="Sunrise Gym").exists()
