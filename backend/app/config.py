"""Central configuration loaded from environment / .env file."""
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent          # backend/
PROJECT_DIR = BASE_DIR.parent                               # project root
ENV_FILE = BASE_DIR / ".env"


def _ensure_env_file() -> None:
    """Create a .env with a strong random SECRET_KEY on first local run."""
    if not ENV_FILE.exists() and "SECRET_KEY" not in os.environ:
        try:
            ENV_FILE.write_text(
                "# Auto-generated. Keep this file private!\n"
                f"SECRET_KEY={secrets.token_urlsafe(64)}\n"
                "TOKEN_EXPIRE_MINUTES=120\n"
                "# Set to true when the site is served over HTTPS (production)\n"
                "COOKIE_SECURE=false\n"
                "DATABASE_URL=sqlite:///./trustline.db\n",
                encoding="utf-8",
            )
        except OSError:
            pass


_ensure_env_file()
if ENV_FILE.exists():
    load_dotenv(ENV_FILE, override=False)

SECRET_KEY: str = os.getenv("SECRET_KEY", "")
if len(SECRET_KEY) < 32:
    SECRET_KEY = secrets.token_urlsafe(64)

ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "120"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_NAME = "tl_admin_session"

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./trustline.db")
if DATABASE_URL.startswith("sqlite:///./"):
    DATABASE_URL = "sqlite:///" + str(BASE_DIR / DATABASE_URL.replace("sqlite:///./", ""))
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgres://"):]
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgresql://"):]

# Cloud image storage (production). Format: cloudinary://<api_key>:<api_secret>@<cloud_name>
# When empty, images are stored in backend/uploads (local development).
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "").strip()
USE_CLOUDINARY = bool(CLOUDINARY_URL)
CLOUDINARY_CLOUD_NAME = CLOUDINARY_URL.rsplit("@", 1)[-1] if USE_CLOUDINARY else ""
CLOUDINARY_FOLDER = os.getenv("CLOUDINARY_FOLDER", "trustline")

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
FRONTEND_DIR = PROJECT_DIR / "frontend"

MAX_UPLOAD_BYTES = 6 * 1024 * 1024      # 6 MB per image
MAX_IMAGE_SIDE = 1600                   # images are resized to this max side

# Brute-force protection
LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCK_SECONDS = 15 * 60
