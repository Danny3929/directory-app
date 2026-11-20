"""Checks for photos an owner uploads. The file's CONTENT decides, never its name.

A file called photo.jpg that is really an .exe fails here, because Pillow
cannot read it as a picture. The stored name is made up by us, never taken
from the client, so "../../x.py" or "a.php.jpg" cannot reach the disk."""
import uuid

from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError

MAX_BYTES = 2 * 1024 * 1024          # 2 MB
MAX_PIXELS = 25_000_000              # stops "decompression bombs": tiny file, huge picture
MAX_PER_GYM = 5
ALLOWED = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


class UploadError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def check_and_rename(upload):
    """Return a ContentFile with a safe generated name, or raise UploadError."""
    if upload.size > MAX_BYTES:
        raise UploadError("The photo is larger than 2 MB.")
    try:
        with Image.open(upload) as img:
            fmt = img.format
            if fmt not in ALLOWED:
                raise UploadError("Only JPEG, PNG or WebP photos are allowed.")
            if img.width * img.height > MAX_PIXELS:
                raise UploadError("The photo has too many pixels (limit 25 million).")
            img.verify()  # reads the whole file's structure, not just the header
    except UploadError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise UploadError("That file is not a valid image.")
    upload.seek(0)
    return ContentFile(upload.read(), name=f"{uuid.uuid4().hex}.{ALLOWED[fmt]}")
