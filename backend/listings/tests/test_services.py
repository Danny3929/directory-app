from datetime import timedelta

import pytest
from django.utils import timezone

from listings import services
from listings.models import Listing


def make(name, lat=-1.29, lng=36.82, **kw):
    return Listing.objects.create(
        name=name, description="d", address="a", city="Nairobi", zip_code="00100",
        latitude=lat, longitude=lng, price_min=1000, price_max=2000,
        is_published=True, **kw,
    )


def test_distance_to_same_point_is_zero():
    assert services.distance_km(-1.29, 36.82, -1.29, 36.82) == 0


def test_distance_nairobi_to_mombasa_is_about_440_km():
    d = services.distance_km(-1.2921, 36.8219, -4.0435, 39.6682)
    assert 430 < d < 445


def test_distance_is_the_same_both_ways():
    a = services.distance_km(-1.29, 36.82, -4.04, 39.66)
    b = services.distance_km(-4.04, 39.66, -1.29, 36.82)
    assert a == pytest.approx(b)


def test_distance_across_the_date_line_is_short():
    assert services.distance_km(0, 179.9, 0, -179.9) < 25


def test_is_featured_only_when_date_is_in_the_future():
    now = timezone.now()
    assert services.is_featured(now + timedelta(days=1), now)
    assert not services.is_featured(now - timedelta(seconds=1), now)
    assert not services.is_featured(now, now)  # exactly now has run out
    assert not services.is_featured(None, now)


@pytest.mark.django_db
def test_within_radius_keeps_near_and_drops_far():
    make("Near", lat=-1.30, lng=36.82)      # ~1 km away
    make("Far", lat=-4.04, lng=39.66)       # Mombasa
    found = services.within_radius(Listing.objects.all(), -1.29, 36.82, 5)
    assert [l.name for l, _ in found] == ["Near"]


@pytest.mark.django_db
def test_within_radius_sorts_nearest_first_and_gives_distance():
    make("B", lat=-1.35)
    make("A", lat=-1.30)
    found = services.within_radius(Listing.objects.all(), -1.29, 36.82, 20)
    assert [l.name for l, _ in found] == ["A", "B"]
    assert found[0][1] < found[1][1]


@pytest.mark.django_db
def test_within_radius_rejects_negative_radius():
    with pytest.raises(ValueError):
        services.within_radius(Listing.objects.all(), 0, 0, -1)


@pytest.mark.django_db
def test_featured_listings_puts_featured_first_then_name():
    now = timezone.now()
    make("Alpha")
    make("Zed", featured_until=now + timedelta(days=3))
    make("Expired", featured_until=now - timedelta(days=3))
    names = [l.name for l in services.featured_first(Listing.objects.all(), now)]
    assert names == ["Zed", "Alpha", "Expired"]
