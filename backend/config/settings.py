"""Django settings for the directory API.

Every secret and every on/off switch comes from environment variables, so
nothing private is ever written in this file. For local work, copy
`.env.example` to `.env`; `load_env_file` below reads it.
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def load_env_file(path):
    """Read KEY=value lines from a .env file into os.environ.

    Lines that are blank or start with # are skipped. A variable that is
    already set in the real environment wins, so a server's settings are never
    overwritten by a stray file.
    """
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def env_bool(name, default=False):
    """True only for 1, true or yes (any case); anything else is False."""
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes"}


def env_list(name, default=""):
    """Split a comma-separated variable into a list, dropping empty parts."""
    return [part.strip() for part in os.environ.get(name, default).split(",") if part.strip()]


# Tests set DJANGO_ENV_FILE_SKIP=1 to check the defaults without a local .env.
if not env_bool("DJANGO_ENV_FILE_SKIP"):
    load_env_file(BASE_DIR / ".env")

# Off unless the environment turns it on, so a forgotten setting fails safe.
DEBUG = env_bool("DJANGO_DEBUG", default=False)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    raise ImproperlyConfigured("Set DJANGO_SECRET_KEY (see .env.example).")

# Only the host names we list may serve the site; never "*".
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "django_filters",
    "drf_spectacular",
    "listings",
    "accounts",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # CORS must run before CommonMiddleware so it can answer preflight requests.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# One URL describes the whole database, e.g. sqlite:///db.sqlite3 locally or
# postgres://user:password@host/name on a server. With no DATABASE_URL set,
# a local SQLite file is used.
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{(BASE_DIR / 'db.sqlite3').as_posix()}", conn_max_age=600
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "Africa/Nairobi"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Owner-uploaded photos. In Task 5 these move to real storage (a server disk is wiped on deploy).
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Only the React app's own addresses may call the API from a browser.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
# Django's CSRF check also compares the Origin header with the API's own host. The
# React app lives on another address, so without this every logged-in POST, PATCH
# and DELETE from a real browser fails with "Origin checking failed".
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)

REST_FRAMEWORK = {
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Visitors can read listings and send an enquiry without logging in.
    # Changing data is only done in the Django admin, which needs a staff login.
    "DEFAULT_AUTHENTICATION_CLASSES": ["accounts.authentication.CookieJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "EXCEPTION_HANDLER": "listings.errors.api_exception_handler",
    # Only the enquiry endpoint uses this scope. Counted per visitor IP in the cache.
    # Behind a proxy (Task 5) set NUM_PROXIES, or every visitor looks like the proxy.
    "DEFAULT_THROTTLE_RATES": {"enquiry": "5/hour", "login": "10/hour"},
}

# When DEBUG is off (a real server), cookies are only sent over HTTPS.
# HSTS and the HTTPS redirect are set up with the hosting in Task 5.
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# Tokens live in httpOnly cookies (see accounts/authentication.py).
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}
# The browser may send the cookie to the exact origin above, never to "*".
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [*default_headers, "x-csrftoken"]

SPECTACULAR_SETTINGS = {
    "TITLE": "Gym Directory API",
    "DESCRIPTION": "Listings, tags and enquiries for the Crepton directory app.",
    "VERSION": "1.0.0",
}
