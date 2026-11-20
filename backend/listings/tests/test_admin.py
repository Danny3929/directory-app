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


def _approve(client, *gyms):
    return client.post(
        "/admin/listings/listing/",
        {"action": "approve_selected", "_selected_action": [g.pk for g in gyms]},
        follow=True,
    )


def test_approve_action_publishes_only_the_selected_gyms(client):
    a, b, c = make_listing(name="A"), make_listing(name="B"), make_listing(name="C")
    for g in (a, b, c):
        g.is_published = False
        g.save()
    client.force_login(User.objects.create_superuser("staff", "s@example.com", "pw-not-used-1"))
    response = _approve(client, a, b)
    for g in (a, b, c):
        g.refresh_from_db()
    assert (a.is_published, b.is_published, c.is_published) == (True, True, False)
    assert "2 listing(s) approved" in response.content.decode()


def test_approve_action_needs_change_permission(client):
    from django.contrib.auth.models import Permission

    gym = make_listing()
    gym.is_published = False
    gym.save()
    viewer = User.objects.create_user("viewer", "v@example.com", "pw-not-used-1", is_staff=True)
    viewer.user_permissions.add(Permission.objects.get(codename="view_listing"))
    client.force_login(viewer)
    _approve(client, gym)
    gym.refresh_from_db()
    assert gym.is_published is False
