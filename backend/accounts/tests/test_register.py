import logging

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
URL = "/api/v1/auth/register/"
GOOD = {"email": "amina@example.com", "password": "Lime-Cactus-42", "role": "owner"}


def register(data=None):
    return APIClient().post(URL, GOOD if data is None else data, format="json")


def test_register_creates_user_with_role():
    resp = register()
    assert resp.status_code == 201
    user = User.objects.get()
    assert user.email == "amina@example.com"
    assert user.profile.role == "owner"
    assert user.check_password("Lime-Cactus-42")  # stored hashed, not as typed
    assert user.password != "Lime-Cactus-42"
    assert resp.data == {"id": user.id, "email": "amina@example.com", "role": "owner"}


def test_visitor_role_works_too():
    assert register({**GOOD, "role": "visitor"}).status_code == 201
    assert User.objects.get().profile.role == "visitor"


def test_email_is_saved_lower_case_and_trimmed():
    register({**GOOD, "email": "  Amina@Example.COM "})
    assert User.objects.get().email == "amina@example.com"


def test_same_email_twice_is_refused_whatever_the_case():
    register()
    resp = register({**GOOD, "email": "AMINA@example.com"})
    assert resp.status_code == 400
    assert "email" in resp.data["error"]["fields"]
    assert User.objects.count() == 1


def test_two_signups_at_the_same_moment_give_400_not_500(monkeypatch):
    # Simulate the race: the "already exists" check passes for both,
    # so only the database's unique username can stop the second one.
    from accounts.serializers import RegisterSerializer
    register()
    monkeypatch.setattr(RegisterSerializer, "validate_email", lambda self, v: v.strip().lower())
    resp = register()
    assert resp.status_code == 400
    assert "email" in resp.data["error"]["fields"]
    assert User.objects.count() == 1


@pytest.mark.parametrize("password", ["short1", "password123", "12345678901", "amina@example.com"])
def test_weak_passwords_are_refused_by_django_validators(password):
    resp = register({**GOOD, "password": password})
    assert resp.status_code == 400
    assert "password" in resp.data["error"]["fields"]
    assert not User.objects.exists()


@pytest.mark.parametrize("role", ["admin", "staff", "", None])
def test_only_visitor_or_owner_can_be_chosen(role):
    resp = register({**GOOD, "role": role})
    assert resp.status_code == 400
    assert "role" in resp.data["error"]["fields"]


@pytest.mark.parametrize("missing", ["email", "password", "role"])
def test_every_field_is_required(missing):
    data = {k: v for k, v in GOOD.items() if k != missing}
    assert register(data).status_code == 400


def test_server_owned_fields_from_the_client_are_ignored():
    register({**GOOD, "is_staff": True, "is_superuser": True, "username": "boss"})
    user = User.objects.get()
    assert not user.is_staff and not user.is_superuser
    assert user.username == "amina@example.com"


def test_password_is_never_sent_back_or_logged(caplog):
    caplog.set_level(logging.DEBUG)
    resp = register()
    assert "password" not in resp.data
    assert "Lime-Cactus-42" not in caplog.text
    bad = register({**GOOD, "email": "x@example.com", "password": "short1"})
    assert "short1" not in str(bad.data)


def test_get_is_not_allowed():
    assert APIClient().get(URL).status_code == 405
