from rest_framework import serializers

from .models import Enquiry, Listing, ListingImage, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["name", "slug"]


class ListingImageSerializer(serializers.ModelSerializer):
    # Only set for owner uploads; seeded photos use "image" (a file name) as before.
    url = serializers.SerializerMethodField()

    class Meta:
        model = ListingImage
        fields = ["image", "alt_text", "url"]

    def get_url(self, obj):
        return obj.file.url if obj.file else None


class OwnerImageSerializer(ListingImageSerializer):
    """Same, plus the id an owner needs to remove a photo."""

    class Meta(ListingImageSerializer.Meta):
        fields = ["id", *ListingImageSerializer.Meta.fields]


class ListingSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    images = ListingImageSerializer(many=True, read_only=True)
    is_featured = serializers.BooleanField(read_only=True)
    # Only set when the search used lat/lng; the view puts it on each gym.
    distance_km = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        # An explicit list: owner and is_published are never sent out.
        fields = [
            "id", "slug", "name", "description", "address", "area", "city", "zip_code",
            "latitude", "longitude", "price_min", "price_max", "tags", "images",
            "is_featured", "distance_km",
        ]
        read_only_fields = fields

    def get_distance_km(self, obj) -> float | None:
        km = getattr(obj, "distance_km", None)
        return None if km is None else round(km, 2)


class SearchParamsSerializer(serializers.Serializer):
    """Checks the query string, so bad input is a clear 400 and never a crash."""
    q = serializers.CharField(required=False, allow_blank=True, max_length=100)
    tags = serializers.CharField(required=False, allow_blank=True, max_length=200)
    price_min = serializers.IntegerField(required=False, min_value=0)
    price_max = serializers.IntegerField(required=False, min_value=0)
    lat = serializers.FloatField(required=False, min_value=-90, max_value=90)
    lng = serializers.FloatField(required=False, min_value=-180, max_value=180)
    radius_km = serializers.FloatField(required=False, min_value=0, max_value=20000)
    sort = serializers.ChoiceField(
        choices=["featured", "cheapest", "distance"], required=False
    )

    def validate(self, data):
        low, high = data.get("price_min"), data.get("price_max")
        if low is not None and high is not None and low > high:
            raise serializers.ValidationError("price_min must not be above price_max.")
        has_point = "lat" in data and "lng" in data
        if ("lat" in data) != ("lng" in data):
            raise serializers.ValidationError("Send lat and lng together.")
        if "radius_km" in data and not has_point:
            raise serializers.ValidationError("radius_km needs lat and lng.")
        if data.get("sort") == "distance" and not has_point:
            raise serializers.ValidationError("sort=distance needs lat and lng.")
        return data


class TagCountSerializer(serializers.ModelSerializer):
    # count is added by the view: how many published gyms have this tag.
    count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ["name", "slug", "count"]
        read_only_fields = fields


class EnquirySerializer(serializers.ModelSerializer):
    """What a visitor may send. Only these three fields are read from the client;
    listing, is_read and created_at are set by the server."""

    class Meta:
        model = Enquiry
        fields = ["name", "email", "message"]


class OwnerListingSerializer(serializers.ModelSerializer):
    """What an owner sees and may change on their own gym.

    Writable: the gym's details and tags. Never read from the client: owner,
    is_published, featured_until, slug, images. The view sets owner from the login."""
    tags = serializers.SlugRelatedField(
        many=True, slug_field="slug", queryset=Tag.objects.all(), required=False,
    )
    images = OwnerImageSerializer(many=True, read_only=True)

    class Meta:
        model = Listing
        fields = [
            "id", "slug", "name", "description", "address", "area", "city", "zip_code",
            "latitude", "longitude", "price_min", "price_max", "tags", "images",
            "is_published", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "slug", "images", "is_published", "created_at", "updated_at"]
        extra_kwargs = {
            "latitude": {"min_value": -90, "max_value": 90},
            "longitude": {"min_value": -180, "max_value": 180},
            "price_min": {"max_value": 10_000_000},
            "price_max": {"max_value": 10_000_000},
        }

    def validate(self, data):
        low = data.get("price_min", getattr(self.instance, "price_min", None))
        high = data.get("price_max", getattr(self.instance, "price_max", None))
        if low is not None and high is not None and low > high:
            raise serializers.ValidationError({"price_min": ["Minimum price cannot be above the maximum."]})
        return data
