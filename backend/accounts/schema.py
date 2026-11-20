"""Tell the Swagger docs how our login works: an httpOnly cookie named gym_access.

Without this, drf-spectacular warns on every view that it cannot describe
CookieJWTAuthentication. Imported once from AccountsConfig.ready().
"""
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .authentication import ACCESS_COOKIE


class CookieJWTScheme(OpenApiAuthenticationExtension):
    target_class = "accounts.authentication.CookieJWTAuthentication"
    name = "cookieAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": ACCESS_COOKIE}


# Shapes used in the docs for the function views in accounts/views.py.
USER = inline_serializer("User", {
    "id": serializers.IntegerField(), "email": serializers.EmailField(), "role": serializers.CharField(),
})
LOGIN = inline_serializer("Login", {"email": serializers.EmailField(), "password": serializers.CharField()})
