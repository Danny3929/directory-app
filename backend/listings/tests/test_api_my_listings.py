import pytest
from rest_framework.test import APIClient

from listings.models import Enquiry, Listing, Tag

pytestmark = pytest.mark.django_db
URL = "/api/v1/me/listings/"
PW = "Lime-Cactus-42"  # allow-commit-check (fake test password)
GYM = {
    "name": "Sunrise Gym", "description": "Bright space", "address": "1 Ngong Rd", "city": "Nairobi",
    "zip_code": "00100", "latitude": -1.29, "longitude": 36.82, "price_min": 1000, "price_max": 3000,
}


def login(email="owner@example.com", role="owner"):
    """A browser-like client (CSRF enforced) already logged in; returns (client, headers)."""
    client = APIClient(enforce_csrf_checks=True)
    APIClient().post("/api/v1/auth/register/", {"email": email, "password": PW, "role": role}, format="json")
    resp = client.post("/api/v1/auth/login/", {"email": email, "password": PW}, format="json")
    assert resp.status_code == 200
    client.defaults["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client


def test_anonymous_gets_401():
    assert APIClient().get(URL).status_code == 401


def test_visitor_cannot_create_or_list():
    visitor = login("v@example.com", role="visitor")
    assert visitor.post(URL, GYM, format="json").status_code == 403
    assert visitor.get(URL).status_code == 403
    assert Listing.objects.count() == 0


def test_create_sets_owner_from_login_and_starts_unpublished():
    owner = login()
    Tag.objects.create(name="Yoga")
    resp = owner.post(URL, {**GYM, "tags": ["yoga"]}, format="json")
    assert resp.status_code == 201
    gym = Listing.objects.get()
    assert gym.owner.email == "owner@example.com"
    assert gym.is_published is False and gym.slug == "sunrise-gym"
    assert resp.data["tags"] == ["yoga"]
    # Hidden from the public until approved.
    assert APIClient().get("/api/v1/listings/").json()["count"] == 0


def test_client_cannot_set_server_owned_fields():
    other = login("other@example.com")
    other_id = other.get("/api/v1/auth/me/").data["id"]
    owner = login()
    resp = owner.post(URL, {**GYM, "owner": other_id, "is_published": True, "featured_until": "2999-01-01T00:00:00Z", "slug": "mine"}, format="json")
    assert resp.status_code == 201
    gym = Listing.objects.get()
    assert gym.owner.email == "owner@example.com"
    assert gym.is_published is False and gym.featured_until is None and gym.slug == "sunrise-gym"


def test_update_cannot_publish_or_change_owner():
    owner = login()
    gid = owner.post(URL, GYM, format="json").data["id"]
    resp = owner.patch(f"{URL}{gid}/", {"name": "Sunset Gym", "is_published": True, "owner": 999}, format="json")
    assert resp.status_code == 200
    gym = Listing.objects.get()
    assert gym.name == "Sunset Gym" and gym.is_published is False and gym.owner.email == "owner@example.com"


@pytest.mark.parametrize("bad", [
    {"price_min": 5000, "price_max": 100}, {"latitude": 95}, {"longitude": -200},
    {"name": ""}, {"price_min": -1}, {"tags": ["no-such-tag"]},
])
def test_bad_input_is_400_not_500(bad):
    owner = login()
    resp = owner.post(URL, {**GYM, **bad}, format="json")
    assert resp.status_code == 400
    assert Listing.objects.count() == 0


def test_price_check_also_on_partial_update():
    owner = login()
    gid = owner.post(URL, GYM, format="json").data["id"]
    assert owner.patch(f"{URL}{gid}/", {"price_max": 10}, format="json").status_code == 400


def test_list_shows_only_my_gyms():
    a, b = login("a@example.com"), login("b@example.com")
    a.post(URL, {**GYM, "name": "A gym"}, format="json")
    b.post(URL, {**GYM, "name": "B gym"}, format="json")
    names = [g["name"] for g in a.get(URL).json()["results"]]
    assert names == ["A gym"]


def test_other_owner_gets_404_on_read_edit_delete():
    a, b = login("a@example.com"), login("b@example.com")
    gid = a.post(URL, GYM, format="json").data["id"]
    assert b.get(f"{URL}{gid}/").status_code == 404
    assert b.patch(f"{URL}{gid}/", {"name": "Hacked"}, format="json").status_code == 404
    assert b.delete(f"{URL}{gid}/").status_code == 404
    assert Listing.objects.get().name == "Sunrise Gym"


def test_unsafe_requests_need_the_csrf_header():
    owner = login()
    del owner.defaults["HTTP_X_CSRFTOKEN"]
    assert owner.post(URL, GYM, format="json").status_code == 403


def test_delete_own_gym():
    owner = login()
    gid = owner.post(URL, GYM, format="json").data["id"]
    assert owner.delete(f"{URL}{gid}/").status_code == 204
    assert Listing.objects.count() == 0


def test_gym_with_enquiries_gives_409_not_500():
    owner = login()
    gid = owner.post(URL, GYM, format="json").data["id"]
    Enquiry.objects.create(listing_id=gid, name="x", email="x@example.com", message="hi")
    resp = owner.delete(f"{URL}{gid}/")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "has_enquiries"
    assert Listing.objects.count() == 1


def test_list_query_count_does_not_grow_with_gyms(django_assert_max_num_queries):
    owner = login()
    for i in range(6):
        owner.post(URL, {**GYM, "name": f"Gym {i}"}, format="json")
    with django_assert_max_num_queries(6):  # user, count, gyms, tags, images (+ profile)
        assert owner.get(URL).status_code == 200
