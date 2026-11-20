from django.db import connection, transaction
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.decorators import action, api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from . import services
from .permissions import IsListingOwner, IsOwnerRole
from .models import Enquiry, Listing, ListingImage, Tag
from .uploads import MAX_BYTES, MAX_PER_GYM, UploadError, check_and_rename
from .serializers import (
    EnquirySerializer, ListingSerializer, OwnerImageSerializer, OwnerListingSerializer, SearchParamsSerializer, TagCountSerializer,
)


class ListingPagination(PageNumberPagination):
    page_size = 12  # fixed: the client cannot ask for more


class ListingViewSet(viewsets.ReadOnlyModelViewSet):
    """Public, read-only gym directory. Only published gyms are ever shown."""
    serializer_class = ListingSerializer
    pagination_class = ListingPagination
    lookup_field = "slug"
    filter_backends = []  # we filter by hand below
    throttle_scope = None  # only the enquiries action sets one

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

    @extend_schema(request=EnquirySerializer, responses={201: OpenApiTypes.OBJECT})
    @action(
        detail=True, methods=["post"], url_path="enquiries",
        throttle_classes=[ScopedRateThrottle], throttle_scope="enquiry",
    )
    def enquiries(self, request, slug=None):
        """Send a message to a gym. Limited to 5 an hour per visitor."""
        gym = self.get_object()  # published gyms only, so a hidden one is a 404
        serializer = EnquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enquiry = serializer.save(listing=gym)
        # Reply without echoing the visitor's personal details back.
        return Response(
            {"id": enquiry.pk, "message": f"Thanks, your message was sent to {gym.name}."},
            status=status.HTTP_201_CREATED,
        )


class MyListingViewSet(viewsets.ModelViewSet):
    """An owner's own gyms: list, create, read, edit, delete.

    The queryset is only this owner's gyms, so another owner's id is a 404, not
    a hint that it exists. New gyms start unpublished until an admin approves."""
    serializer_class = OwnerListingSerializer
    pagination_class = ListingPagination
    permission_classes = [IsOwnerRole, IsListingOwner]
    filter_backends = []

    def get_queryset(self):
        return (
            Listing.objects.filter(owner=self.request.user)
            .prefetch_related("tags", "images").order_by("-created_at", "-id")
        )

    def perform_create(self, serializer):
        # Server-owned fields come from the login and the rules, never the request.
        serializer.save(owner=self.request.user, is_published=False)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"error": {"code": "has_enquiries", "message": "This gym has enquiries, so it cannot be deleted."}},
                status=status.HTTP_409_CONFLICT,
            )

    @action(detail=True, methods=["post"], url_path="images", parser_classes=[MultiPartParser, FormParser])
    def add_image(self, request, pk=None):
        """Upload one photo (form field "file", optional "alt_text") to one of my gyms."""
        gym = self.get_object()  # 404 for another owner's gym
        # Refuse a huge upload from its header, before reading all of it.
        if int(request.META.get("CONTENT_LENGTH") or 0) > MAX_BYTES + 100_000:
            return self._upload_error("too_large", "The photo is larger than 2 MB.", status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        upload = request.FILES.get("file")
        if upload is None:
            return self._upload_error("no_file", "Choose a photo to upload.")
        try:
            safe_file = check_and_rename(upload)
        except UploadError as exc:
            return self._upload_error("bad_image", exc.message)
        alt = request.data.get("alt_text", "")[:200]
        with transaction.atomic():
            count = gym.images.count()
            if count >= MAX_PER_GYM:
                return self._upload_error("too_many", f"A gym can have at most {MAX_PER_GYM} photos.")
            image = ListingImage.objects.create(listing=gym, file=safe_file, alt_text=alt, position=count)
        return Response(OwnerImageSerializer(image).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"images/(?P<image_id>\d+)")
    def remove_image(self, request, pk=None, image_id=None):
        """Remove one of my gym's photos (seeded or uploaded). The file goes with it."""
        gym = self.get_object()
        get_object_or_404(gym.images, pk=image_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _upload_error(code, message, http=status.HTTP_400_BAD_REQUEST):
        return Response({"error": {"code": code, "message": message}}, status=http)


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
