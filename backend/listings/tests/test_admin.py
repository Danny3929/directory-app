import pytest
from django.contrib.auth.models import User

from listings.tests.test_models import make_listing

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("page", ["tag", "listing", "enquiry"])
def test_admin_list_pages_load_for_staff(client, page):
    make_listing()
    client.force_login(User.objects.create_superuser("staff", "s@example.com", "pw-not-used-1"))
    assert client.get(f"/admin/listings/{page}/").status_code == 200


def test_admin_gym_page_shows_the_photo_inline(client):
    gym = make_listing()
    client.force_login(User.objects.create_superuser("staff", "s@example.com", "pw-not-used-1"))
    page = client.get(f"/admin/listings/listing/{gym.pk}/change/")
    assert page.status_code == 200
    assert b"images-TOTAL_FORMS" in page.content


def test_admin_is_closed_to_visitors(client):
    assert client.get("/admin/listings/listing/").status_code == 302
