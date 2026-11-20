from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from listings.models import Listing, ListingImage, Tag

pytestmark = pytest.mark.django_db
URL = "/api/v1/listings/"


@pytest.fixture
def client():
    return APIClient()


def make(name, lat=-1.29, lng=36.82, pmin=1000, pmax=2000, published=True, tags=(), **kw):
    gym = Listing.objects.create(
        name=name, description=kw.pop("description", "d"), address="a", city="Nairobi",
        zip_code="00100", latitude=lat, longitude=lng, price_min=pmin, price_max=pmax,
        is_published=published, **kw,
    )
    for t in tags:
        gym.tags.add(Tag.objects.get_or_create(name=t)[0])
    return gym


def names(resp):
    return [r["name"] for r in resp.data["results"]]


def test_list_shape_and_published_only(client):
    gym = make("Alpha", tags=["Yoga"])
    ListingImage.objects.create(listing=gym, image="a.webp", alt_text="Alt")
    make("Hidden", published=False)
    resp = client.get(URL)
    assert resp.status_code == 200
    assert resp.data["count"] == 1
    row = resp.data["results"][0]
    assert row["slug"] == "alpha"
    assert row["tags"] == [{"name": "Yoga", "slug": "yoga"}]
    assert row["images"] == [{"image": "a.webp", "alt_text": "Alt", "url": None}]
    assert row["distance_km"] is None
    assert "owner" not in row


def test_page_size_is_12(client):
    for i in range(15):
        make(f"Gym {i:02d}")
    resp = client.get(URL)
    assert len(resp.data["results"]) == 12
    assert resp.data["count"] == 15
    assert len(client.get(URL, {"page": 2}).data["results"]) == 3


def test_page_size_cannot_be_raised_by_the_client(client):
    for i in range(15):
        make(f"Gym {i:02d}")
    assert len(client.get(URL, {"page_size": 100}).data["results"]) == 12


def test_text_search_name_and_description_ignoring_case(client):
    make("Iron Works")
    make("Calm", description="Quiet IRON-free yoga")
    make("Other")
    assert sorted(names(client.get(URL, {"q": "iron"}))) == ["Calm", "Iron Works"]


def test_tags_must_all_match(client):
    make("Both", tags=["Yoga", "Pool"])
    make("One", tags=["Yoga"])
    assert names(client.get(URL, {"tags": "yoga"})) == ["Both", "One"]
    assert names(client.get(URL, {"tags": "yoga,pool"})) == ["Both"]


def test_price_ranges_must_overlap(client):
    make("Cheap", pmin=500, pmax=1000)
    make("Mid", pmin=1500, pmax=2500)
    make("Posh", pmin=5000, pmax=9000)
    assert names(client.get(URL, {"price_min": 1000, "price_max": 1500})) == ["Cheap", "Mid"]


def test_price_min_above_max_is_a_400_not_a_crash(client):
    resp = client.get(URL, {"price_min": 5000, "price_max": 100})
    assert resp.status_code == 400


def test_radius_filters_and_sorts_nearest_first_with_distance(client):
    make("Mid", lat=-1.33)
    make("Near", lat=-1.30)
    make("Far", lat=-4.04, lng=39.66)
    resp = client.get(URL, {"lat": -1.29, "lng": 36.82, "radius_km": 20})
    assert names(resp) == ["Near", "Mid"]
    assert resp.data["results"][0]["distance_km"] < resp.data["results"][1]["distance_km"]


def test_radius_needs_lat_and_lng(client):
    assert client.get(URL, {"radius_km": 5}).status_code == 400
    assert client.get(URL, {"lat": 95, "lng": 0, "radius_km": 5}).status_code == 400
    assert client.get(URL, {"lat": 0, "lng": 0, "radius_km": -1}).status_code == 400


def test_sort_cheapest_and_featured(client):
    soon = timezone.now() + timedelta(days=2)
    make("Dear", pmin=3000, pmax=4000)
    make("Cheap", pmin=500, pmax=900)
    make("Star", pmin=2000, pmax=3000, featured_until=soon)
    assert names(client.get(URL, {"sort": "cheapest"})) == ["Cheap", "Star", "Dear"]
    assert names(client.get(URL)) == ["Star", "Cheap", "Dear"]  # default: featured first
    assert client.get(URL, {"sort": "nonsense"}).status_code == 400


def test_detail_by_slug_and_404s(client):
    make("Alpha")
    make("Hidden", published=False)
    assert client.get(URL + "alpha/").data["name"] == "Alpha"
    assert client.get(URL + "hidden/").status_code == 404
    assert client.get(URL + "nope/").status_code == 404


def test_no_n_plus_one_queries(client, django_assert_max_num_queries):
    for i in range(10):
        gym = make(f"Gym {i}", tags=["Yoga", "Pool"])
        ListingImage.objects.create(listing=gym, image="a.webp", alt_text="x")
    with django_assert_max_num_queries(4):  # count, gyms, tags, images
        assert client.get(URL).status_code == 200


def test_writes_are_not_allowed(client):
    assert client.post(URL, {"name": "x"}).status_code == 405
    make("Alpha")
    assert client.delete(URL + "alpha/").status_code == 405
