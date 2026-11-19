from django.contrib import admin

from .models import Enquiry, Listing, ListingImage, Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    search_fields = ["name"]


class ListingImageInline(admin.TabularInline):
    """Lets staff add and order a gym's photos on the gym's own page."""
    model = ListingImage
    extra = 1
    fields = ["image", "alt_text", "position"]


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ["name", "area", "city", "price_min", "price_max", "is_published", "featured_until"]
    list_filter = ["is_published", "city", "tags"]
    search_fields = ["name", "description", "address", "area", "zip_code"]
    prepopulated_fields = {"slug": ["name"]}
    filter_horizontal = ["tags"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [ListingImageInline]
    # Loads each owner in the same query, instead of one query per row.
    list_select_related = ["owner"]


@admin.register(Enquiry)
class EnquiryAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "listing", "is_read", "created_at"]
    list_filter = ["is_read", "created_at"]
    search_fields = ["name", "email", "message", "listing__name"]
    list_select_related = ["listing"]
    # What the visitor wrote cannot be changed by staff; they can only mark it read.
    readonly_fields = ["listing", "name", "email", "message", "created_at"]
