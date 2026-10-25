"""Safe image handling: validate real image content, strip metadata, resize, re-encode."""
import io
import secrets

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from . import config

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
Image.MAX_IMAGE_PIXELS = 40_000_000  # decompression-bomb protection


async def save_image(file: UploadFile, prefix: str = "img") -> str:
    data = await file.read(config.MAX_UPLOAD_BYTES + 1)
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image too large (max 6 MB)")
    if not data:
        raise HTTPException(400, "Empty file")
    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()                              # structural check
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_FORMATS:
            raise HTTPException(400, "Only JPG, PNG, WEBP or GIF images are allowed")
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "File is not a valid image")

    img.thumbnail((config.MAX_IMAGE_SIDE, config.MAX_IMAGE_SIDE))
    # Random server-side name: the original filename is never used.
    name = f"{prefix}_{secrets.token_hex(12)}.webp"
    img.save(config.UPLOAD_DIR / name, "WEBP", quality=85, method=4)   # no EXIF => metadata stripped
    return name


def delete_image(name: str | None) -> None:
    if not name:
        return
    path = (config.UPLOAD_DIR / name).resolve()
    if path.parent == config.UPLOAD_DIR.resolve() and path.exists():
        path.unlink()
