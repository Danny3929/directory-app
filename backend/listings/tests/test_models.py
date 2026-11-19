from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.utils import timezone

from listings.models import Enquiry, Listing, ListingImage, Tag

pytestmark = pytest.mark.django_db


def make_listing(**extra):
    fields = dict(
        name="Sunrise Gym", description="A gym.", address="1 Road", city="Nairobi",
        zip_code="00100", latitude=-1.28, longitude=36.82, price_min=3000, price_max=5000,
    )
    fields.update(extra)
    return Listing.objects.create(**fields)


def test_slug_is_made_from_the_name_and_kept_unique():
    first = make_listing()
    second = make_listing()
    assert first.slug == "sunrise-gym"
    assert second.slug == "sunrise-gym-2"


def test_saving_again_keeps_the_same_slug():
    gym = make_listing()
    gym.description = "Changed."
    gym.save()
    gym.refresh_from_db()
    assert gym.slug == "sunrise-gym"


def test_tag_slug_is_made_from_the_name():
    assert Tag.objects.create(name="Open 24 Hours").slug == "open-24-hours"


def test_database_refuses_min_price_above_max():
    with pytest.raises(IntegrityError):
        make_listing(price_min=9000, price_max=5000)


def test_featured_only_while_featured_until_is_in_the_future():
    now = timezone.now()
    assert make_listing(featured_until=now + timedelta(days=1)).is_featured is True
    assert make_listing(featured_until=now - timedelta(seconds=1)).is_featured is False
    assert make_listing(featured_until=None).is_featured is False


def test_published_hides_unpublished_gyms():
    shown = make_listing(name="Shown", is_published=True)
    make_listing(name="Hidden", is_published=False)
    assert list(Listing.objects.published()) == [shown]


def test_gym_with_enquiries_cannot_be_deleted_but_photos_go_with_it():
    gym = make_listing()
    ListingImage.objects.create(listing=gym, image="a.webp", alt_text="A gym")
    Enquiry.objects.create(listing=gym, name="Ann", email="ann@example.com", message="Hi")
    with pytest.raises(ProtectedError):
        gym.delete()

    other = make_listing(name="Other")
    ListingImage.objects.create(listing=other, image="b.webp", alt_text="B gym")
    other.delete()
    assert not ListingImage.objects.filter(image="b.webp").exists()
