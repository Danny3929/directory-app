from django.conf import settings
from django.db import models


class BoostPurchase(models.Model):
    """One "Boost this listing" checkout. Created as pending; only the webhook marks it paid."""

    class Status(models.TextChoices):
        PENDING = "pending", "Waiting for Stripe"
        PAID = "paid", "Paid"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="boosts"
    )
    # If the gym is deleted later, the payment record stays, with the name kept below.
    listing = models.ForeignKey(
        "listings.Listing", null=True, on_delete=models.SET_NULL, related_name="boosts"
    )
    listing_name = models.CharField(max_length=200)
    # Whole Kenyan shillings, like the listing prices.
    amount_ksh = models.PositiveIntegerField()
    days = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    stripe_session_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    # The listing's featured_until right after this payment was applied.
    featured_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.listing_name}: {self.amount_ksh} KES ({self.status})"


class ProcessedStripeEvent(models.Model):
    """Every Stripe event we have handled. Stripe retries, so a repeat must do nothing."""

    event_id = models.CharField(max_length=255, unique=True)
    type = models.CharField(max_length=100)
    received_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.event_id} ({self.type})"
