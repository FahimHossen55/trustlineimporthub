"""Safe image handling: validate real image content, strip metadata, resize, re-encode."""
import io
import os
import secrets

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from . import config

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
Image.MAX_IMAGE_PIXELS = 40_000_000  # decompression-bomb protection

if config.USE_CLOUDINARY:
    import cloudinary
    import cloudinary.uploader
    cloudinary.config(cloudinary_url=config.CLOUDINARY_URL)


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

    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=85, method=4)
    buf.seek(0)

    if config.USE_CLOUDINARY:
        public_id = f"{prefix}_{secrets.token_hex(12)}"
        res = cloudinary.uploader.upload(
            buf,
            folder=config.CLOUDINARY_FOLDER,
            public_id=public_id,
            resource_type="image",
            format="webp",
            overwrite=True,
            invalidate=True,
        )
        return res.get("secure_url") or res.get("url")

    # Local storage fallback
    name = f"{prefix}_{secrets.token_hex(12)}.webp"
    with open(config.UPLOAD_DIR / name, "wb") as f:
        f.write(buf.getvalue())
    return name


def delete_image(name: str | None) -> None:
    if not name:
        return
    if name.startswith("http://") or name.startswith("https://"):
        if config.USE_CLOUDINARY:
            try:
                import cloudinary.uploader
                # Extract public_id from Cloudinary URL:
                # e.g., https://res.cloudinary.com/<cloud>/image/upload/v12345/trustline/img_xyz.webp
                if "/upload/" in name:
                    after_upload = name.split("/upload/", 1)[1]
                    parts = after_upload.split("/")
                    if parts and parts[0].startswith("v") and parts[0][1:].isdigit():
                        parts = parts[1:]
                    public_id_with_ext = "/".join(parts)
                    public_id = public_id_with_ext.rsplit(".", 1)[0]
                    cloudinary.uploader.destroy(public_id, invalidate=True)
            except Exception:
                pass
    else:
        path = (config.UPLOAD_DIR / name).resolve()
        if path.parent == config.UPLOAD_DIR.resolve() and path.exists():
            path.unlink()
