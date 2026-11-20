from django.urls import path

from . import views

urlpatterns = [
    path("checkout/", views.checkout, name="billing-checkout"),
    path("webhook/", views.webhook, name="billing-webhook"),
    path("history/", views.BillingHistory.as_view(), name="billing-history"),
]
