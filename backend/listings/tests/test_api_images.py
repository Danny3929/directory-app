import io
import os

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from listings.models import Listing, ListingImage
from listings.tests.test_api_my_listings import GYM, login

pytestmark = pytest.mark.django_db
URL = "/api/v1/me/listings/"


@pytest.fixture(autouse=True)
def media_in_tmp(settings, tmp_path):
    """Uploads go to a throwaway folder, never the real media/ folder."""
    settings.MEDIA_ROOT = tmp_path


def picture(fmt="PNG", size=(40, 30)):
    buf = io.BytesIO()
    Image.new("RGB", size, "teal").save(buf, format=fmt)
    return buf.getvalue()


def upload(name, data, content_type="image/png"):
    return {"file": SimpleUploadedFile(name, data, content_type=content_type), "alt_text": "A gym floor"}


def make_gym(owner):
    return Listing.objects.get(pk=owner.post(URL, GYM, format="json").data["id"])


def post_image(client, gym, payload):
    return client.post(f"{URL}{gym.id}/images/", payload, format="multipart")


@pytest.mark.parametrize("fmt,ext", [("JPEG", "jpg"), ("PNG", "png"), ("WEBP", "webp")])
def test_valid_photo_is_saved_with_a_generated_name(tmp_path, fmt, ext):
    owner = login()
    gym = make_gym(owner)
    resp = post_image(owner, gym, upload("../../evil name.exe", picture(fmt)))  # client's name is ignored
    assert resp.status_code == 201
    saved = ListingImage.objects.get()
    assert saved.file.name.startswith("listing_photos/") and saved.file.name.endswith(f".{ext}")
    assert "evil" not in saved.file.name
    assert os.path.exists(saved.file.path)
    assert resp.data["url"].endswith(saved.file.name) and resp.data["alt_text"] == "A gym floor"


def test_a_sixth_photo_is_refused():
    owner = login()
    gym = make_gym(owner)
    for _ in range(5):
        assert post_image(owner, gym, upload("a.png", picture())).status_code == 201
    resp = post_image(owner, gym, upload("a.png", picture()))
    assert resp.status_code == 400 and resp.data["error"]["code"] == "too_many"
    assert gym.images.count() == 5


def test_five_megabyte_file_is_refused():
    owner = login()
    gym = make_gym(owner)
    noise = Image.frombytes("RGB", (1300, 1300), os.urandom(1300 * 1300 * 3))
    buf = io.BytesIO()
    noise.save(buf, format="PNG")
    assert len(buf.getvalue()) > 4_500_000
    resp = post_image(owner, gym, upload("big.png", buf.getvalue()))
    assert resp.status_code in (400, 413)
    assert resp.data["error"]["code"] in ("too_large", "bad_image")
    assert gym.images.count() == 0


def test_an_exe_renamed_to_jpg_is_refused():
    owner = login()
    gym = make_gym(owner)
    fake = b"MZ\x90\x00" + b"\x00" * 500  # a Windows program header, not a picture
    resp = post_image(owner, gym, upload("holiday.jpg", fake, "image/jpeg"))
    assert resp.status_code == 400 and resp.data["error"]["code"] == "bad_image"
    assert gym.images.count() == 0


def test_a_real_picture_of_a_disallowed_type_is_refused():
    owner = login()
    gym = make_gym(owner)
    resp = post_image(owner, gym, upload("x.png", picture("GIF"), "image/png"))  # named .png, really GIF
    assert resp.status_code == 400 and resp.data["error"]["code"] == "bad_image"


def test_a_tiny_file_with_a_huge_picture_inside_is_refused():
    owner = login()
    gym = make_gym(owner)
    resp = post_image(owner, gym, upload("bomb.png", picture("PNG", (6000, 5000))))  # 30 million pixels
    assert resp.status_code == 400 and resp.data["error"]["code"] == "bad_image"


def test_a_cut_off_picture_is_refused():
    owner = login()
    gym = make_gym(owner)
    resp = post_image(owner, gym, upload("cut.png", picture("PNG", (200, 200))[:-30]))
    assert resp.status_code == 400 and gym.images.count() == 0


def test_missing_file_is_a_clear_error():
    owner = login()
    gym = make_gym(owner)
    resp = owner.post(f"{URL}{gym.id}/images/", {"alt_text": "x"}, format="multipart")
    assert resp.status_code == 400 and resp.data["error"]["code"] == "no_file"


def test_another_owner_cannot_add_or_remove_photos():
    a, b = login("a@example.com"), login("b@example.com")
    gym = make_gym(a)
    assert post_image(a, gym, upload("a.png", picture())).status_code == 201
    image = ListingImage.objects.get()
    assert post_image(b, gym, upload("b.png", picture())).status_code == 404
    assert b.delete(f"{URL}{gym.id}/images/{image.id}/").status_code == 404
    assert gym.images.count() == 1 and os.path.exists(image.file.path)


def test_visitor_and_anonymous_cannot_upload():
    gym = make_gym(login())
    assert post_image(login("v@example.com", role="visitor"), gym, upload("a.png", picture())).status_code == 403
    assert post_image(APIClient(), gym, upload("a.png", picture())).status_code == 401


def test_removing_a_photo_deletes_the_file_too():
    owner = login()
    gym = make_gym(owner)
    post_image(owner, gym, upload("a.png", picture()))
    image = ListingImage.objects.get()
    path = image.file.path
    assert owner.delete(f"{URL}{gym.id}/images/{image.id}/").status_code == 204
    assert not os.path.exists(path) and gym.images.count() == 0


def test_cannot_remove_a_photo_of_a_different_gym_by_guessing_ids():
    owner = login()
    g1, g2 = make_gym(owner), make_gym(owner)
    post_image(owner, g2, upload("a.png", picture()))
    image = ListingImage.objects.get()
    assert owner.delete(f"{URL}{g1.id}/images/{image.id}/").status_code == 404
    assert g2.images.count() == 1


def test_seeded_file_name_photos_still_work():
    owner = login()
    gym = make_gym(owner)
    ListingImage.objects.create(listing=gym, image="classes-2.webp", alt_text="Class")
    data = owner.get(f"{URL}{gym.id}/").data["images"][0]
    assert data["image"] == "classes-2.webp" and data["url"] is None
