from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from .views import ListingViewSet, MyEnquiryViewSet, MyListingViewSet, TagViewSet, health

router = DefaultRouter()
router.register("listings", ListingViewSet, basename="listing")
router.register("me/listings", MyListingViewSet, basename="my-listing")
router.register("me/enquiries", MyEnquiryViewSet, basename="my-enquiry")
router.register("tags", TagViewSet, basename="tag")

urlpatterns = [
    path("health/", health, name="health"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
] + router.urls
