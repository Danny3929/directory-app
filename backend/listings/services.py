"""Business rules that don't belong in views or models: distance and featured."""
from math import asin, cos, radians, sin, sqrt

from django.db.models import Case, IntegerField, Value, When
from django.utils import timezone

EARTH_RADIUS_KM = 6371.0088


def distance_km(lat1, lng1, lat2, lng2):
    """Straight-line distance over the Earth's surface (haversine), in km."""
    p1, p2 = radians(lat1), radians(lat2)
    dlat = p2 - p1
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(p1) * cos(p2) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


def is_featured(featured_until, now=None):
    """Featured only while the date is still in the future."""
    now = now or timezone.now()
    return featured_until is not None and featured_until > now


def within_radius(queryset, lat, lng, radius_km):
    """[(listing, km)] within radius_km, nearest first.

    The distance is worked out in Python, which is fine for a few hundred gyms.
    """
    if radius_km < 0:
        raise ValueError("radius_km must not be negative")
    found = []
    for listing in queryset:
        km = distance_km(lat, lng, listing.latitude, listing.longitude)
        if km <= radius_km:
            found.append((listing, km))
    found.sort(key=lambda pair: pair[1])
    return found


def featured_first(queryset, now=None):
    """Featured gyms first, then by name; done in the database, one query."""
    now = now or timezone.now()
    return queryset.annotate(
        _featured=Case(
            When(featured_until__gt=now, then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        )
    ).order_by("_featured", "name")
