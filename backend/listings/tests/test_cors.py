import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
URL = "/api/v1/me/listings/"
SITE = "https://gyms.example.com"
STRANGER = "https://evil.example.net"


def preflight(origin):
    """What a browser sends before a cross-site POST that carries the login cookie."""
    return APIClient().options(
        URL, HTTP_ORIGIN=origin,
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,x-csrftoken",
    )


def test_listed_origin_may_send_cookies(settings):
    settings.CORS_ALLOWED_ORIGINS = [SITE]
    resp = preflight(SITE)
    assert resp["Access-Control-Allow-Origin"] == SITE  # the exact origin, never "*"
    assert resp["Access-Control-Allow-Credentials"] == "true"
    assert "x-csrftoken" in resp["Access-Control-Allow-Headers"].lower()


def test_unlisted_origin_gets_no_permission(settings):
    settings.CORS_ALLOWED_ORIGINS = [SITE]
    resp = preflight(STRANGER)
    assert "Access-Control-Allow-Origin" not in resp
    assert "Access-Control-Allow-Credentials" not in resp


def test_actual_response_to_stranger_is_not_readable(settings):
    settings.CORS_ALLOWED_ORIGINS = [SITE]
    resp = APIClient().get("/api/v1/tags/", HTTP_ORIGIN=STRANGER)
    assert "Access-Control-Allow-Origin" not in resp


def test_no_wildcard_setting():
    from django.conf import settings as real
    assert not getattr(real, "CORS_ALLOW_ALL_ORIGINS", False)
    assert "*" not in real.CORS_ALLOWED_ORIGINS
