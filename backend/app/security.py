"""Authentication & security helpers."""
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from . import config
from .database import get_db
from .models import Owner


# ---------- Passwords ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode())
    except ValueError:
        return False


# Used to keep timing equal when the username does not exist
_DUMMY_HASH = hash_password("dummy-password-for-timing")


# ---------- JWT ----------
def create_token(owner: Owner) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(owner.id),
        "ver": owner.token_version,
        "iat": now,
        "exp": now + timedelta(minutes=config.TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm=config.ALGORITHM)


def get_current_owner(request: Request, db: Session = Depends(get_db)) -> Owner:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = request.cookies.get(config.COOKIE_NAME)
    if not token:
        raise unauthorized
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
    except jwt.PyJWTError:
        raise unauthorized
    owner = db.get(Owner, int(payload.get("sub", 0)))
    if not owner or owner.token_version != payload.get("ver"):
        raise unauthorized

    # CSRF defence (in addition to SameSite=Strict): state-changing requests
    # must carry a custom header that cross-site forms cannot set.
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.headers.get("X-Requested-With") != "TrustLineAdmin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing CSRF header")
    return owner


# ---------- Brute-force limiter ----------
class LoginLimiter:
    def __init__(self):
        self._fails: dict[str, list[float]] = defaultdict(list)
        self._locked_until: dict[str, float] = {}
        self._lock = Lock()

    def check(self, key: str) -> int:
        """Return seconds remaining on lock (0 if not locked)."""
        with self._lock:
            until = self._locked_until.get(key, 0)
            remaining = int(until - time.time())
            if remaining > 0:
                return remaining
            self._locked_until.pop(key, None)
            return 0

    def fail(self, key: str) -> None:
        with self._lock:
            now = time.time()
            window = [t for t in self._fails[key] if now - t < config.LOGIN_LOCK_SECONDS]
            window.append(now)
            self._fails[key] = window
            if len(window) >= config.LOGIN_MAX_ATTEMPTS:
                self._locked_until[key] = now + config.LOGIN_LOCK_SECONDS
                self._fails[key] = []

    def success(self, key: str) -> None:
        with self._lock:
            self._fails.pop(key, None)
            self._locked_until.pop(key, None)


login_limiter = LoginLimiter()
