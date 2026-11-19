from rest_framework import serializers

from .models import Enquiry, Listing, ListingImage, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["name", "slug"]


class ListingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingImage
        fields = ["image", "alt_text"]


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
