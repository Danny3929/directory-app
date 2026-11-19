import pytest
from rest_framework.test import APIClient

from listings.models import Enquiry, Listing

pytestmark = pytest.mark.django_db
GOOD = {"name": "Amina", "email": "amina@example.com", "message": "Do you have a pool?"}


def gym(name="Alpha", published=True):
    return Listing.objects.create(
        name=name, description="d", address="a", city="Nairobi", zip_code="00100",
        latitude=-1.29, longitude=36.82, price_min=1, price_max=2, is_published=published,
    )


def post(slug="alpha", data=None, client=None):
    return (client or APIClient()).post(f"/api/v1/listings/{slug}/enquiries/", GOOD if data is None else data, format="json")


def test_valid_enquiry_is_saved_against_the_gym():
    g = gym()
    resp = post()
    assert resp.status_code == 201
    saved = Enquiry.objects.get()
    assert (saved.listing, saved.name, saved.email) == (g, "Amina", "amina@example.com")
    assert saved.is_read is False
    assert "email" not in resp.data  # we do not echo personal data back


def test_text_is_trimmed():
    gym()
    post(data={**GOOD, "name": "  Amina  ", "message": "  hi  "})
    saved = Enquiry.objects.get()
    assert (saved.name, saved.message) == ("Amina", "hi")


@pytest.mark.parametrize("field,value", [
    ("name", ""), ("name", "   "), ("name", "x" * 101),
    ("email", "not-an-email"), ("email", ""),
    ("message", ""), ("message", "   "), ("message", "x" * 2001),
])
def test_bad_fields_are_400_with_the_field_named(field, value):
    gym()
    resp = post(data={**GOOD, field: value})
    assert resp.status_code == 400
    assert field in resp.data["error"]["fields"]
    assert Enquiry.objects.count() == 0


def test_missing_fields_are_400():
    gym()
    assert post(data={}).status_code == 400


def test_client_cannot_set_server_owned_fields():
    g = gym()
    other = gym("Other")
    post(data={**GOOD, "is_read": True, "listing": other.pk, "created_at": "2001-01-01T00:00:00Z"})
    saved = Enquiry.objects.get()
    assert saved.is_read is False
    assert saved.listing == g
    assert saved.created_at.year > 2020


def test_hidden_or_unknown_gym_is_404_and_saves_nothing():
    gym("Hidden", published=False)
    assert post("hidden").status_code == 404
    assert post("nope").status_code == 404
    assert Enquiry.objects.count() == 0


def test_error_shape_is_consistent():
    gym()
    for resp in (post(data={}), post("nope")):
        err = resp.data["error"]
        assert set(err) >= {"code", "message"}
    assert post(data={}).data["error"]["code"] == "invalid"
    assert post("nope").data["error"]["code"] == "not_found"


def test_sixth_enquiry_in_an_hour_is_429():
    gym()
    client = APIClient()
    for _ in range(5):
        assert post(client=client).status_code == 201
    resp = post(client=client)
    assert resp.status_code == 429
    assert resp.data["error"]["code"] == "throttled"
    assert Enquiry.objects.count() == 5


def test_throttle_does_not_slow_reading_listings():
    gym()
    client = APIClient()
    for _ in range(6):
        post(client=client)
    assert client.get("/api/v1/listings/").status_code == 200


def test_get_on_enquiries_is_not_allowed():
    gym()
    assert APIClient().get("/api/v1/listings/alpha/enquiries/").status_code == 405


def test_unexpected_crash_is_a_plain_500_without_details(monkeypatch):
    from listings import views

    def boom(*a, **k):
        raise RuntimeError("secret path C:/app/settings.py password=hunter2")

    monkeypatch.setattr(views.Enquiry.objects, "create", boom, raising=False)
    gym()
    client = APIClient(raise_request_exception=False)
    resp = post(client=client)
    assert resp.status_code == 500
    body = resp.content.decode()
    assert "hunter2" not in body and "Traceback" not in body
    assert resp.json()["error"]["code"] == "server_error"
