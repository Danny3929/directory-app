import logging

import stripe
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import generics, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from listings.models import Listing
from listings.permissions import IsOwnerRole
from listings.views import ListingPagination

from . import services
from .models import BoostPurchase

logger = logging.getLogger(__name__)


class CheckoutRequest(serializers.Serializer):
    listing_id = serializers.IntegerField(min_value=1)


@api_view(["POST"])
@permission_classes([IsOwnerRole])
def checkout(request):
    """Start paying for a boost. Returns Stripe's payment page address; nothing is boosted yet."""
    body = CheckoutRequest(data=request.data)
    body.is_valid(raise_exception=True)
    # Only this owner's gyms are searched, so someone else's id is a plain 404.
    listing = get_object_or_404(Listing, pk=body.validated_data["listing_id"], owner=request.user)
    if not listing.is_published:
        return Response(
            {"error": {"code": "not_published", "message": "This gym is waiting for approval, so it cannot be boosted yet."}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        url = services.start_checkout(request.user, listing)
    except services.BillingUnavailable as exc:
        return Response(
            {"error": {"code": "billing_unavailable", "message": str(exc)}},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response({"url": url}, status=status.HTTP_201_CREATED)


@csrf_exempt  # Stripe cannot send our CSRF token; the signature check below replaces it.
@require_POST
def webhook(request):
    """Stripe calls this after a payment. The signature proves the call came from Stripe."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        return HttpResponse(status=503)
    try:
        event = stripe.Webhook.construct_event(
            request.body,
            request.headers.get("Stripe-Signature", ""),
            settings.STRIPE_WEBHOOK_SECRET,
        )
    except (ValueError, stripe.SignatureVerificationError):
        # Bad JSON or a bad signature: say nothing more than "no".
        return HttpResponse(status=400)
    result = services.handle_event(event.to_dict())
    logger.info("Stripe event %s (%s): %s", event.id, event.type, result)
    return HttpResponse(status=200)


class BoostPurchaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoostPurchase
        fields = [
            "id", "listing", "listing_name", "amount_ksh", "days",
            "status", "created_at", "paid_at", "featured_until",
        ]


class BillingHistory(generics.ListAPIView):
    """The logged-in owner's boosts, newest first, 12 per page."""
    serializer_class = BoostPurchaseSerializer
    permission_classes = [IsOwnerRole]
    pagination_class = ListingPagination

    def get_queryset(self):
        return BoostPurchase.objects.filter(owner=self.request.user)
