"""Login by httpOnly cookie. JavaScript never sees the tokens.

A browser sends cookies by itself, so a malicious site could make the browser
send a request for the user (CSRF). Defence: SameSite=Lax on the cookies, and
every unsafe request (POST, PUT, PATCH, DELETE) must also carry Django's CSRF
token in the X-CSRFToken header, which only our own React app can read.
"""
from django.conf import settings
from django.contrib.auth.models import User
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

ACCESS_COOKIE = "gym_access"
REFRESH_COOKIE = "gym_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth/"  # the refresh token is only sent to the auth endpoints
SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


def enforce_csrf(request):
    """Raise 403 unless the request carries a valid CSRF token."""
    http_request = getattr(request, "_request", request)
    check = CsrfViewMiddleware(lambda req: None)
    check.process_request(http_request)
    reason = check.process_view(http_request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied("CSRF check failed. Reload the page and try again.")


def set_auth_cookies(response, access=None, refresh=None):
    common = {"httponly": True, "samesite": "Lax", "secure": not settings.DEBUG}
    if access is not None:
        seconds = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
        response.set_cookie(ACCESS_COOKIE, str(access), max_age=seconds, path="/", **common)
    if refresh is not None:
        seconds = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
        response.set_cookie(REFRESH_COOKIE, str(refresh), max_age=seconds, path=REFRESH_COOKIE_PATH, **common)


def clear_auth_cookies(response):
    response.delete_cookie(ACCESS_COOKIE, path="/", samesite="Lax")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, samesite="Lax")


class CookieJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        raw = request.COOKIES.get(ACCESS_COOKIE)
        if not raw:
            return None
        try:
            token = AccessToken(raw)
        except TokenError:
            # Expired or forged: treat as logged out. Public pages must keep working;
            # protected views answer 401 and the app then calls /auth/refresh/.
            return None
        user = User.objects.filter(pk=token["user_id"], is_active=True).first()
        if user is None:
            return None
        if request.method not in SAFE_METHODS:
            enforce_csrf(request)
        return (user, token)

    def authenticate_header(self, request):
        return "Cookie"  # makes DRF answer 401 (not 403) when no valid login is present
