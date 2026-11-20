import logging
from datetime import timedelta

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

pytestmark = pytest.mark.django_db
LOGIN, REFRESH, LOGOUT, ME = (f"/api/v1/auth/{n}/" for n in ("login", "refresh", "logout", "me"))
EMAIL, PASSWORD = "amina@example.com", "Lime-Cactus-42"  # allow-commit-check (fake test password)


def make_user(role="owner", email=EMAIL):
    client = APIClient()
    client.post("/api/v1/auth/register/", {"email": email, "password": PASSWORD, "role": role}, format="json")


def logged_in_client():
    """A client that checks CSRF like a real browser and holds the cookies."""
    make_user()
    client = APIClient(enforce_csrf_checks=True)
    resp = client.post(LOGIN, {"email": EMAIL, "password": PASSWORD}, format="json")
    assert resp.status_code == 200
    return client, resp


def csrf(client):
    return {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value}


def test_login_sets_httponly_cookies_and_returns_no_token_in_body():
    client, resp = logged_in_client()
    assert resp.data == {"id": User.objects.get().id, "email": EMAIL, "role": "owner"}
    for name in ("gym_access", "gym_refresh"):
        assert resp.cookies[name]["httponly"] is True
        assert resp.cookies[name]["samesite"] == "Lax"
    assert resp.cookies["gym_refresh"]["path"] == "/api/v1/auth/"
    assert not resp.cookies["csrftoken"]["httponly"]  # React must be able to read this one
    body = resp.content.decode()
    assert resp.cookies["gym_access"].value not in body
    assert resp.cookies["gym_refresh"].value not in body


def test_login_accepts_email_in_any_case():
    make_user()
    resp = APIClient().post(LOGIN, {"email": "  AMINA@Example.com ", "password": PASSWORD}, format="json")
    assert resp.status_code == 200


def test_wrong_password_and_unknown_email_give_the_same_answer():
    make_user()
    wrong = APIClient().post(LOGIN, {"email": EMAIL, "password": "nope-nope-1"}, format="json")
    unknown = APIClient().post(LOGIN, {"email": "who@example.com", "password": PASSWORD}, format="json")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert "gym_access" not in wrong.cookies


@pytest.mark.parametrize("body", [{}, {"email": EMAIL}, {"email": 5, "password": ["x"]}, {"email": None, "password": None}])
def test_login_with_missing_or_odd_fields_is_400_not_500(body):
    assert APIClient().post(LOGIN, body, format="json").status_code == 400


def test_inactive_user_cannot_log_in():
    make_user()
    User.objects.update(is_active=False)
    assert APIClient().post(LOGIN, {"email": EMAIL, "password": PASSWORD}, format="json").status_code == 401


def test_login_is_throttled_after_ten_tries():
    make_user()
    client = APIClient()
    codes = [client.post(LOGIN, {"email": EMAIL, "password": "wrong-pass-1"}, format="json").status_code for _ in range(11)]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429
    # Even the right password is refused while throttled.
    assert client.post(LOGIN, {"email": EMAIL, "password": PASSWORD}, format="json").status_code == 429


def test_me_needs_login():
    assert APIClient().get(ME).status_code == 401


def test_me_returns_the_logged_in_user():
    client, _ = logged_in_client()
    resp = client.get(ME)
    assert resp.status_code == 200
    assert resp.data["email"] == EMAIL and resp.data["role"] == "owner"


def test_expired_or_forged_access_cookie_means_logged_out_but_public_pages_still_work():
    make_user()
    user = User.objects.get()
    expired = AccessToken.for_user(user)
    expired.set_exp(lifetime=timedelta(seconds=-60))
    for bad in (str(expired), "not.a.token"):
        client = APIClient()
        client.cookies["gym_access"] = bad
        assert client.get(ME).status_code == 401
        assert client.get("/api/v1/listings/").status_code == 200


def test_a_refresh_token_is_not_accepted_as_an_access_token():
    make_user()
    client = APIClient()
    client.cookies["gym_access"] = str(RefreshToken.for_user(User.objects.get()))
    assert client.get(ME).status_code == 401


def test_refresh_gives_a_new_access_cookie():
    client, _ = logged_in_client()
    resp = client.post(REFRESH, **csrf(client))
    assert resp.status_code == 200
    assert resp.cookies["gym_access"]["httponly"] is True
    assert client.get(ME).status_code == 200


def test_refresh_without_cookie_or_with_junk_is_401_and_clears_cookies():
    client = APIClient(enforce_csrf_checks=True)
    client.get(ME)
    client.cookies["csrftoken"] = "a" * 64
    client.cookies["gym_refresh"] = "junk"
    resp = client.post(REFRESH, HTTP_X_CSRFTOKEN="a" * 64)
    assert resp.status_code == 401
    assert resp.cookies["gym_refresh"]["max-age"] == 0


def test_refresh_fails_for_a_user_who_was_deactivated():
    client, _ = logged_in_client()
    User.objects.update(is_active=False)
    assert client.post(REFRESH, **csrf(client)).status_code == 401


def test_unsafe_requests_with_cookie_login_need_the_csrf_header():
    client, _ = logged_in_client()
    assert client.post(REFRESH).status_code == 403  # logged in, but no X-CSRFToken header
    assert client.post(LOGOUT).status_code == 403
    assert client.post(REFRESH, HTTP_X_CSRFTOKEN="wrong").status_code == 403


def test_access_cookie_alone_cannot_post_to_other_endpoints_without_csrf():
    """Public enquiry POST by a logged-in browser still needs the CSRF header."""
    client, _ = logged_in_client()
    assert client.post("/api/v1/listings/1/enquiries/", {}, format="json").status_code == 403


def test_logout_clears_cookies():
    client, _ = logged_in_client()
    resp = client.post(LOGOUT, **csrf(client))
    assert resp.status_code == 204
    assert resp.cookies["gym_access"]["max-age"] == 0
    assert resp.cookies["gym_refresh"]["max-age"] == 0


def test_passwords_and_tokens_are_never_logged(caplog):
    make_user()
    with caplog.at_level(logging.DEBUG):
        client = APIClient()
        resp = client.post(LOGIN, {"email": EMAIL, "password": PASSWORD}, format="json")
        client.post(LOGIN, {"email": EMAIL, "password": "Secret-Wrong-77"}, format="json")
    logged = caplog.text
    assert PASSWORD not in logged and "Secret-Wrong-77" not in logged
    assert resp.cookies["gym_access"].value not in logged
    assert resp.cookies["gym_refresh"].value not in logged
