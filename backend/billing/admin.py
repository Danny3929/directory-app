from django.contrib import admin

from .models import BoostPurchase, ProcessedStripeEvent


@admin.register(BoostPurchase)
class BoostPurchaseAdmin(admin.ModelAdmin):
    list_display = ["listing_name", "owner", "amount_ksh", "status", "created_at", "paid_at"]
    list_filter = ["status"]
    list_select_related = ["owner"]
    # Payments are written by the webhook only; staff can look but not change them.
    readonly_fields = [f.name for f in BoostPurchase._meta.fields]


@admin.register(ProcessedStripeEvent)
class ProcessedStripeEventAdmin(admin.ModelAdmin):
    list_display = ["event_id", "type", "received_at"]
    readonly_fields = ["event_id", "type", "received_at"]
