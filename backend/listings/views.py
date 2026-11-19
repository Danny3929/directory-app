from django.db import connection
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from . import services
from .models import Listing, Tag
from .serializers import ListingSerializer, SearchParamsSerializer, TagCountSerializer


class ListingPagination(PageNumberPagination):
    page_size = 12  # fixed: the client cannot ask for more


class ListingViewSet(viewsets.ReadOnlyModelViewSet):
    """Public, read-only gym directory. Only published gyms are ever shown."""
    serializer_class = ListingSerializer
    pagination_class = ListingPagination
    lookup_field = "slug"
    filter_backends = []  # we filter by hand below

    def get_queryset(self):
        # prefetch: tags and photos come in 2 extra queries, not 2 per gym.
        return Listing.objects.published().prefetch_related("tags", "images")

    @extend_schema(parameters=[SearchParamsSerializer])
    def list(self, request, *args, **kwargs):
        params = SearchParamsSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        p = params.validated_data
        qs = self.get_queryset()

        text = p.get("q", "").strip()
        if text:
            qs = qs.filter(Q(name__icontains=text) | Q(description__icontains=text))
        for slug in [t.strip() for t in p.get("tags", "").split(",") if t.strip()]:
            qs = qs.filter(tags__slug=slug)  # one filter per tag: gym needs ALL of them
        # Price ranges overlap, and a plan exactly on a limit counts.
        if "price_max" in p:
            qs = qs.filter(price_min__lte=p["price_max"])
        if "price_min" in p:
            qs = qs.filter(price_max__gte=p["price_min"])

        sort = p.get("sort", "featured")
        if sort == "cheapest":
            qs = qs.order_by("price_min", "name")
        elif sort == "featured":
            qs = services.featured_first(qs, timezone.now())
        else:  # "distance": handled below once we have the point
            qs = qs.order_by("name")

        if "lat" in p and ("radius_km" in p or sort == "distance"):
            pairs = services.within_radius(qs, p["lat"], p["lng"], p.get("radius_km", 20000))
            for gym, km in pairs:
                gym.distance_km = km
            # within_radius puts the nearest first. Keep that for sort=distance or
            # no sort; otherwise restore the order the chosen sort gave.
            if "sort" in p and sort != "distance":
                order = {g.pk: i for i, g in enumerate(qs)}
                pairs.sort(key=lambda pair: order[pair[0].pk])
            qs = [gym for gym, _ in pairs]

        page = self.paginate_queryset(qs)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    """Tags used by at least one published gym, with how many gyms have each."""
    serializer_class = TagCountSerializer
    pagination_class = None  # a short list; the filter chips need all of it
    filter_backends = []
    lookup_field = "slug"

    def get_queryset(self):
        # One query: the count is worked out in the database.
        return (
            Tag.objects.filter(listings__is_published=True)
            .annotate(count=Count("listings"))
            .order_by("name")
        )


@extend_schema(responses={200: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT})
@api_view(["GET"])
def health(request):
    """For the host's uptime check. Never shows error details."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return Response({"status": "error", "database": "down"}, status=503)
    return Response({"status": "ok", "database": "ok"})
