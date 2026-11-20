import pytest
from rest_framework.test import APIClient

from listings.models import Enquiry, Listing
from listings.tests.test_api_my_listings import GYM, URL as LISTINGS_URL, login

pytestmark = pytest.mark.django_db
URL = "/api/v1/me/enquiries/"


def make_gym(owner_client, name="Sunrise Gym"):
    return Listing.objects.get(pk=owner_client.post(LISTINGS_URL, {**GYM, "name": name}, format="json").data["id"])


def send(gym, name="Visitor", **extra):
    return Enquiry.objects.create(listing=gym, name=name, email="v@example.com", message="Hello", **extra)


def test_anonymous_gets_401_and_visitor_gets_403():
    assert APIClient().get(URL).status_code == 401
    assert login("v@example.com", role="visitor").get(URL).status_code == 403


def test_owner_sees_only_enquiries_for_own_gyms():
    a, b = login("a@example.com"), login("b@example.com")
    gym_a, gym_b = make_gym(a, "A Gym"), make_gym(b, "B Gym")
    send(gym_a, "For A")
    send(gym_b, "For B")
    names = [e["name"] for e in a.get(URL).json()["results"]]
    assert names == ["For A"]
    assert a.get(URL).json()["results"][0]["listing_name"] == "A Gym"


def test_unread_filter_and_count():
    owner = login()
    gym = make_gym(owner)
    send(gym, "old", is_read=True)
    send(gym, "new")
    send(gym, "newer")
    assert owner.get(URL).json()["count"] == 3
    assert owner.get(URL + "?unread=1").json()["count"] == 2
    assert owner.get(URL + "unread-count/").json() == {"unread": 2}


def test_unread_count_ignores_other_owners():
    a, b = login("a@example.com"), login("b@example.com")
    send(make_gym(a, "A Gym"))
    assert b.get(URL + "unread-count/").json() == {"unread": 0}


def test_mark_read_changes_only_is_read():
    owner = login()
    enq = send(make_gym(owner))
    resp = owner.post(f"{URL}{enq.pk}/read/")
    assert resp.status_code == 200 and resp.json()["is_read"] is True
    enq.refresh_from_db()
    assert enq.is_read is True and enq.message == "Hello"
    # Marking twice is harmless.
    assert owner.post(f"{URL}{enq.pk}/read/").status_code == 200
    assert owner.get(URL + "unread-count/").json() == {"unread": 0}


def test_other_owner_cannot_read_or_mark_enquiry():
    a, b = login("a@example.com"), login("b@example.com")
    enq = send(make_gym(a, "A Gym"))
    assert b.get(f"{URL}{enq.pk}/").status_code == 404
    assert b.post(f"{URL}{enq.pk}/read/").status_code == 404
    enq.refresh_from_db()
    assert enq.is_read is False


def test_owner_cannot_edit_or_delete_enquiries():
    owner = login()
    enq = send(make_gym(owner))
    assert owner.patch(f"{URL}{enq.pk}/", {"message": "x"}, format="json").status_code == 405
    assert owner.delete(f"{URL}{enq.pk}/").status_code == 405
    assert Enquiry.objects.filter(pk=enq.pk, message="Hello").exists()


def test_list_uses_constant_queries(django_assert_max_num_queries):
    owner = login()
    gym = make_gym(owner)
    for i in range(10):
        send(gym, f"v{i}")
    with django_assert_max_num_queries(6):  # session/user/profile + count + rows; not one per row
        assert owner.get(URL).status_code == 200


def test_gym_with_enquiries_cannot_be_deleted():
    owner = login()
    gym = make_gym(owner)
    send(gym)
    assert owner.delete(f"{LISTINGS_URL}{gym.pk}/").status_code == 409
    assert Enquiry.objects.count() == 1 and Listing.objects.count() == 1
