from rest_framework.permissions import BasePermission


class IsOwnerRole(BasePermission):
    """Logged in AND registered as an owner. Visitors can read, never create gyms."""
    message = "Only gym owners can do this."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and getattr(getattr(user, "profile", None), "role", None) == "owner"
        )


class IsListingOwner(BasePermission):
    """Object check: this gym belongs to the person asking. The view's queryset
    already hides other owners' gyms (404); this is the second lock."""

    def has_object_permission(self, request, view, obj):
        return obj.owner_id is not None and obj.owner_id == request.user.id
