from django.conf import settings
from django.db import models


class Profile(models.Model):
    """Extra facts about a user that Django's own User does not have.

    One profile per user. The role decides what the user may do:
    a visitor saves gyms and sends enquiries; an owner also manages gym pages.
    Staff (Joy, admins) are Django's is_staff flag, never a role a user can pick.
    """

    class Role(models.TextChoices):
        VISITOR = "visitor", "Visitor"
        OWNER = "owner", "Gym owner"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.VISITOR)

    def __str__(self):
        return f"{self.user.email} ({self.role})"
