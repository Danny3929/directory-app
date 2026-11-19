import json
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from listings.models import Listing, ListingImage, Tag

pytestmark = pytest.mark.django_db


def gym(slug="flexline-fitness", **extra):
    row = {
        "slug": slug, "name": "Flexline Fitness", "description": "Classes all week.",
        "address": "17 Argwings Kodhek Rd", "area": "Kilimani", "city": "Nairobi",
        "zip": "00619", "lat": -1.2885, "lng": 36.7852, "priceMin": 5000, "priceMax": 6500,
        "tags": ["classes", "beginner"], "photos": ["classes.webp", "classes-2.webp"],
        "isFeatured": False,
    }
    row.update(extra)
    return row


def seed(tmp_path, rows):
    path = tmp_path / "gyms.json"
    path.write_text(json.dumps(rows), encoding="utf-8")
    call_command("seed_listings", file=str(path))


def test_creates_published_gyms_with_tags_and_photos(tmp_path):
    seed(tmp_path, [gym()])
    g = Listing.objects.get(slug="flexline-fitness")
    assert g.is_published
    assert g.zip_code == "00619" and g.price_min == 5000 and g.latitude == -1.2885
    assert sorted(t.slug for t in g.tags.all()) == ["beginner", "classes"]
    assert [i.image for i in g.images.all()] == ["classes.webp", "classes-2.webp"]
    assert [i.position for i in g.images.all()] == [0, 1]


def test_running_twice_makes_no_duplicates(tmp_path):
    rows = [gym(), gym("other-gym", name="Other Gym", tags=["classes"])]
    seed(tmp_path, rows)
    seed(tmp_path, rows)
    assert Listing.objects.count() == 2
    assert Tag.objects.count() == 2
    assert ListingImage.objects.count() == 4


def test_running_again_updates_changed_data(tmp_path):
    seed(tmp_path, [gym()])
    seed(tmp_path, [gym(priceMax=9000, tags=["yoga"], photos=["yoga.webp"])])
    g = Listing.objects.get(slug="flexline-fitness")
    assert g.price_max == 9000
    assert [t.slug for t in g.tags.all()] == ["yoga"]
    assert [i.image for i in g.images.all()] == ["yoga.webp"]


def test_featured_flag_becomes_a_future_date(tmp_path):
    seed(tmp_path, [gym(isFeatured=True), gym("plain", name="Plain Gym")])
    assert Listing.objects.get(slug="flexline-fitness").is_featured
    assert not Listing.objects.get(slug="plain").is_featured


def test_second_run_does_not_push_the_featured_date_further(tmp_path):
    seed(tmp_path, [gym(isFeatured=True)])
    first = Listing.objects.get().featured_until
    seed(tmp_path, [gym(isFeatured=True)])
    assert Listing.objects.get().featured_until == first


def test_a_gym_hidden_by_staff_stays_hidden(tmp_path):
    seed(tmp_path, [gym()])
    Listing.objects.update(is_published=False)
    seed(tmp_path, [gym()])
    assert not Listing.objects.get().is_published


def test_bad_row_saves_nothing(tmp_path):
    bad = gym("bad-gym", name="Bad", priceMin=9000, priceMax=100)  # min above max
    with pytest.raises(CommandError):
        seed(tmp_path, [gym(), bad])
    assert Listing.objects.count() == 0


def test_missing_file_is_a_clear_error(tmp_path):
    with pytest.raises(CommandError, match="not found"):
        call_command("seed_listings", file=str(tmp_path / "nope.json"))


def test_real_task_2_data_loads(tmp_path):
    call_command("seed_listings")
    call_command("seed_listings")
    assert Listing.objects.count() == 45
    assert Listing.objects.published().count() == 45
    assert not Listing.objects.filter(images__isnull=True).exists()


def test_gyms_keep_their_task_2_id(tmp_path):
    seed(tmp_path, [gym(id=7)])
    assert Listing.objects.get(slug="flexline-fitness").pk == 7


def test_api_sends_the_id(client, tmp_path):
    seed(tmp_path, [gym(id=7)])
    row = client.get("/api/listings/flexline-fitness/").json()
    assert row["id"] == 7
