"""Owner photos on Cloudinary instead of the server's disk.

Render wipes the server's disk on every deploy, so photos saved there vanish.
This small Django storage hands each file to Cloudinary and keeps only its name
(for example "listing_photos/3f9c...e1.jpg") in the database.

Used only when the CLOUDINARY_URL environment variable is set (see settings.py);
the cloudinary package reads that variable for its account details itself.
"""
import posixpath

import cloudinary
import cloudinary.uploader
import cloudinary.utils
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


def _public_id(name):
    """Cloudinary's id for a file is its name without the extension."""
    return posixpath.splitext(name)[0]


@deconstructible
class CloudinaryStorage(Storage):
    def _save(self, name, content):
        content.seek(0)
        cloudinary.uploader.upload(
            content, public_id=_public_id(name), resource_type="image",
            overwrite=False, unique_filename=False,
        )
        return name

    def exists(self, name):
        # Names are random (uploads.check_and_rename), so a clash is not expected.
        return False

    def url(self, name):
        return cloudinary.utils.cloudinary_url(name, secure=True, resource_type="image")[0]

    def delete(self, name):
        cloudinary.uploader.destroy(_public_id(name), resource_type="image", invalidate=True)
