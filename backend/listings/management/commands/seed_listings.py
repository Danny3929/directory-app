"""Load the Task 2 gyms into the database: `python manage.py seed_listings`.

Safe to run again: a gym is matched by its slug, so a second run updates the
rows instead of adding copies. All rows are saved together or not at all.
"""

import json
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction
from django.utils import timezone

from listings.models import Listing, ListingImage, Tag

DEFAULT_FILE = settings.BASE_DIR.parent / "frontend" / "src" / "data" / "listings.json"
FEATURED_DAYS = 30


class Command(BaseCommand):
    help = "Load gyms from the Task 2 JSON file. Safe to run more than once."

    def add_arguments(self, parser):
        parser.add_argument("--file", default=str(DEFAULT_FILE), help="path to the JSON file")

    def handle(self, *args, file, **options):
        path = Path(file)
        if not path.is_file():
            raise CommandError(f"File not found: {path}")
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"{path.name} is not valid JSON: {exc}") from exc

        try:
            with transaction.atomic():  # one bad row undoes the whole run
                for row in rows:
                    self.save_row(row)
        except (KeyError, ValidationError, IntegrityError, TypeError) as exc:
            raise CommandError(f"Nothing was saved. Bad row: {exc!r}") from exc

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(rows)} gyms."))

    def save_row(self, row):
        listing, created = Listing.objects.get_or_create(
            slug=row["slug"], defaults=self.fields(row, is_published=True)
        )
        if not created:
            # Keep is_published as staff left it; refresh everything else.
            for key, value in self.fields(row).items():
                setattr(listing, key, value)
        if row.get("isFeatured") and not listing.is_featured:
            listing.featured_until = timezone.now() + timedelta(days=FEATURED_DAYS)
        listing.full_clean()
        listing.save()

        listing.tags.set([self.tag(name) for name in row.get("tags", [])])
        listing.images.all().delete()
        ListingImage.objects.bulk_create(
            ListingImage(listing=listing, image=photo, alt_text=f"{listing.name} photo {i + 1}", position=i)
            for i, photo in enumerate(row.get("photos", []))
        )

    @staticmethod
    def fields(row, **extra):
        return dict(
            name=row["name"], description=row["description"], address=row["address"],
            area=row.get("area", ""), city=row["city"], zip_code=row["zip"],
            latitude=row["lat"], longitude=row["lng"],
            price_min=row["priceMin"], price_max=row["priceMax"], **extra,
        )

    @staticmethod
    def tag(name):
        tag, _ = Tag.objects.get_or_create(name=name.strip().title() if name.islower() else name)
        return tag
