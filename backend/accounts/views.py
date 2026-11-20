from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from rest_framework import exceptions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    enforce_csrf,
    set_auth_cookies,
)
from .serializers import RegisterSerializer


def user_data(user):
    return {"id": user.id, "email": user.email, "role": user.profile.role}


class LoginThrottle(SimpleRateThrottle):
    scope = "login"  # rate in settings; counted per visitor IP (see the NUM_PROXIES note there)

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(serializer.to_representation(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login(request):
    data = request.data if hasattr(request.data, "get") else {}
    email, password = data.get("email"), data.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        raise exceptions.ValidationError({"email": ["Enter your email and password."]})
    # One message for "no such email" and "wrong password", so it reveals nothing.
    user = authenticate(request, username=email.strip().lower(), password=password)
    if user is None or not hasattr(user, "profile"):
        raise exceptions.AuthenticationFailed("Email or password is incorrect.")
    refresh_token = RefreshToken.for_user(user)
    response = Response(user_data(user))
    set_auth_cookies(response, access=refresh_token.access_token, refresh=refresh_token)
    get_token(request._request)  # makes Django set the csrftoken cookie that React echoes back
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh(request):
    enforce_csrf(request)
    raw = request.COOKIES.get(REFRESH_COOKIE)
    try:
        token = RefreshToken(raw) if raw else None
    except TokenError:
        token = None
    user = User.objects.filter(pk=token["user_id"], is_active=True).first() if token else None
    if user is None:
        response = Response(
            {"error": {"code": "unauthorized", "message": "Please log in again."}},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        clear_auth_cookies(response)
        return response
    response = Response(user_data(user))
    set_auth_cookies(response, access=token.access_token)
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def logout(request):
    # JavaScript cannot delete httpOnly cookies, so the server does it.
    enforce_csrf(request)
    response = Response(status=status.HTTP_204_NO_CONTENT)
    clear_auth_cookies(response)
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(user_data(request.user))
