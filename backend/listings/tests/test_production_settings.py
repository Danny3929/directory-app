"""Task 5 production switches in config/settings.py, and the Cloudinary storage.

Settings are imported in a fresh Python that sees only the variables given, so
the laptop's .env never leaks into the result.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

from django.core.files.base import ContentFile

from config import storage

BACKEND = Path(__file__).resolve().parents[2]
SHOW = (
    "import json, config.settings as s; print(json.dumps({"
    "'redirect': getattr(s, 'SECURE_SSL_REDIRECT', False), 'hsts': getattr(s, 'SECURE_HSTS_SECONDS', 0),"
    "'proxies': s.REST_FRAMEWORK['NUM_PROXIES'], 'media': s.STORAGES['default']['BACKEND']}))"
)


def settings_with(env):
    clean = {"SYSTEMROOT": os.environ.get("SYSTEMROOT", ""), "DJANGO_ENV_FILE_SKIP": "1",
             "DJANGO_SECRET_KEY": "x", **env}
    result = subprocess.run([sys.executable, "-c", SHOW], cwd=BACKEND, env=clean, capture_output=True, text=True)
    return result


def test_laptop_defaults_have_no_https_redirect_and_local_media():
    out = json.loads(settings_with({}).stdout)
    assert out == {"redirect": False, "hsts": 0, "proxies": None,
                   "media": "django.core.files.storage.FileSystemStorage"}


def test_server_switches_turn_on_https_proxies_and_cloudinary():
    env = {"DJANGO_HTTPS": "True", "NUM_PROXIES": "1",
           "CLOUDINARY_URL": "cloudinary://key:secret@demo"}  # allow-commit-check (fake)
    out = json.loads(settings_with(env).stdout)
    assert out["redirect"] is True and out["hsts"] >= 31536000
    assert out["proxies"] == 1
    assert out["media"] == "config.storage.CloudinaryStorage"


def test_a_live_stripe_key_stops_the_server_starting():
    result = settings_with({"STRIPE_SECRET_KEY": "sk_live_" + "x" * 20})  # allow-commit-check
    assert result.returncode != 0 and "Live Stripe keys" in result.stderr


def test_cloudinary_storage_uploads_names_and_deletes(monkeypatch):
    calls = {}
    monkeypatch.setattr(storage.cloudinary.uploader, "upload",
                        lambda f, **kw: calls.setdefault("upload", (f.read(), kw)))
    monkeypatch.setattr(storage.cloudinary.uploader, "destroy",
                        lambda pid, **kw: calls.setdefault("destroy", pid))
    monkeypatch.setattr(storage.cloudinary.utils, "cloudinary_url",
                        lambda name, **kw: (f"https://res.cloudinary.com/demo/image/upload/{name}", {}))
    s = storage.CloudinaryStorage()
    name = s.save("listing_photos/abc.jpg", ContentFile(b"bytes"))
    assert name == "listing_photos/abc.jpg"
    body, options = calls["upload"]
    assert body == b"bytes" and options["public_id"] == "listing_photos/abc"
    assert s.url(name).startswith("https://res.cloudinary.com/")
    s.delete(name)
    assert calls["destroy"] == "listing_photos/abc"
