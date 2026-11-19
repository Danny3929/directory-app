"""The four tables behind the gym directory.

Tag          a label such as "yoga"; many gyms can share a tag
Listing      one gym; it has many tags, many images and many enquiries
ListingImage one photo of a gym, in display order
Enquiry      one message a visitor sent to a gym
"""

from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone
from django.utils.text import slugify


def unique_slug(model, text, exclude_pk=None):
    """Turn a name into a web-address slug no other row uses yet.

    "Sunrise Gym" becomes "sunrise-gym"; if that is taken, "sunrise-gym-2",
    then "sunrise-gym-3", and so on.
    """
    base = slugify(text)[:200] or "item"
    slug, n = base, 2
    others = model.objects.exclude(pk=exclude_pk)
    while others.filter(slug=slug).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=60, unique=True, blank=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Tag, self.name, exclude_pk=self.pk)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ListingQuerySet(models.QuerySet):
    def published(self):
        """Only gyms the public may see."""
        return self.filter(is_published=True)


class Listing(models.Model):
    # Who owns the gym page. Empty for now; logins arrive in Task 4.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="listings",
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField()
    address = models.CharField(max_length=200)
    area = models.CharField(max_length=100, blank=True)  # e.g. "Kilimani"; kept from Task 2
    city = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=10)
    latitude = models.FloatField()
    longitude = models.FloatField()
    # Whole Kenyan shillings per month; no cents.
    price_min = models.PositiveIntegerField()
    price_max = models.PositiveIntegerField()
    tags = models.ManyToManyField(Tag, related_name="listings", blank=True)
    # Featured while this date is in the future, so nothing has to switch it off.
    featured_until = models.DateTimeField(null=True, blank=True)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ListingQuerySet.as_manager()

    class Meta:
        ordering = ["name"]
        constraints = [
            # The database itself refuses a minimum price above the maximum.
            models.CheckConstraint(
                condition=Q(price_min__lte=F("price_max")), name="price_min_not_above_max"
            ),
            models.CheckConstraint(
                condition=Q(latitude__gte=-90, latitude__lte=90)
                & Q(longitude__gte=-180, longitude__lte=180),
                name="coordinates_on_earth",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Listing, self.name, exclude_pk=self.pk)
        super().save(*args, **kwargs)

    @property
    def is_featured(self):
        return self.featured_until is not None and self.featured_until > timezone.now()

    def __str__(self):
        return self.name


class ListingImage(models.Model):
    # Photos go when their gym goes.
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="images")
    # A file name in the frontend's public photos folder, e.g. "classes-2.webp".
    # Real uploads (with type, size and content checks) come in Task 4.
    image = models.CharField(max_length=200)
    alt_text = models.CharField(max_length=200)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.listing.name} #{self.position}"


class Enquiry(models.Model):
    # PROTECT: a gym that still has enquiries cannot be deleted, so no visitor's
    # message is lost. Untick is_published to hide a gym instead.
    listing = models.ForeignKey(Listing, on_delete=models.PROTECT, related_name="enquiries")
    name = models.CharField(max_length=100)
    email = models.EmailField()
    message = models.TextField(max_length=2000)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "enquiries"

    def __str__(self):
        return f"{self.name} about {self.listing.name}"
