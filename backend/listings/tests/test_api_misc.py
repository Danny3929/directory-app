import pytest
from rest_framework.test import APIClient

from listings.models import Listing, Tag

pytestmark = pytest.mark.django_db


def gym(name, published=True, tags=()):
    g = Listing.objects.create(
        name=name, description="d", address="a", city="Nairobi", zip_code="00100",
        latitude=-1.29, longitude=36.82, price_min=1, price_max=2, is_published=published,
    )
    for t in tags:
        g.tags.add(Tag.objects.get_or_create(name=t)[0])
    return g


def test_tags_lists_every_tag_with_count_of_published_gyms_only():
    gym("A", tags=["Yoga", "Pool"])
    gym("B", tags=["Yoga"])
    gym("Hidden", published=False, tags=["Yoga", "Secret"])
    resp = APIClient().get("/api/v1/tags/")
    assert resp.status_code == 200
    rows = {r["slug"]: r for r in resp.data}
    assert rows["yoga"] == {"name": "Yoga", "slug": "yoga", "count": 2}
    assert rows["pool"]["count"] == 1
    assert "secret" not in rows  # only used by a hidden gym


def test_tags_is_not_paginated_and_uses_few_queries(django_assert_max_num_queries):
    for i in range(20):
        gym(f"G{i}", tags=[f"Tag{i}"])
    with django_assert_max_num_queries(1):
        resp = APIClient().get("/api/v1/tags/")
    assert len(resp.data) == 20


def test_health_reports_ok_and_database():
    resp = APIClient().get("/api/v1/health/")
    assert resp.status_code == 200
    assert resp.data == {"status": "ok", "database": "ok"}


def test_health_is_503_when_database_is_down(monkeypatch):
    from django.db import connection

    def boom(*a, **k):
        raise RuntimeError("secret connection string postgres://u:p@h/db")

    monkeypatch.setattr(connection, "cursor", boom)
    resp = APIClient().get("/api/v1/health/")
    assert resp.status_code == 503
    assert resp.data == {"status": "error", "database": "down"}
    assert "postgres" not in resp.content.decode()  # no leaked details


def test_schema_is_openapi_and_lists_our_paths():
    resp = APIClient().get("/api/v1/schema/")
    assert resp.status_code == 200
    body = resp.content.decode()
    assert "openapi:" in body
    assert "/api/v1/listings/" in body and "/api/v1/tags/" in body


def test_docs_page_loads():
    resp = APIClient().get("/api/v1/docs/")
    assert resp.status_code == 200
    assert "text/html" in resp["Content-Type"]
