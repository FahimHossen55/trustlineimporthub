"""Trust Line Import HUB - FastAPI application entry point."""
import os

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text

from . import config
from .database import Base, SessionLocal, engine
from .models import Owner
from .routers import admin, auth, public
from .security import hash_password

SHOW_DOCS = os.getenv("SHOW_DOCS", "false").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically initialize tables on start
    Base.metadata.create_all(bind=engine)
    # Ensure admin owner account exists
    db = SessionLocal()
    try:
        if not db.scalar(select(Owner)):
            username = os.getenv("ADMIN_USERNAME", "shahin")
            password = os.getenv("ADMIN_PASSWORD", "Shahin@2026!")
            full_name = os.getenv("ADMIN_FULL_NAME", "Shahin Perveg")
            db.add(Owner(username=username, full_name=full_name, password_hash=hash_password(password)))
            db.commit()
            print(f"[OK] Initial owner account created: Username '{username}'")
    except Exception as e:
        db.rollback()
        print(f"[WARN] Startup owner check: {e}")
    finally:
        db.close()
    yield


app = FastAPI(
    title="Trust Line Import HUB API",
    docs_url="/api/docs" if SHOW_DOCS else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if SHOW_DOCS else None,
    lifespan=lifespan,
)

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: blob: https://res.cloudinary.com; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "object-src 'none'"
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    h = response.headers
    h["Content-Security-Policy"] = CSP
    h["X-Content-Type-Options"] = "nosniff"
    h["X-Frame-Options"] = "DENY"
    h["Referrer-Policy"] = "strict-origin-when-cross-origin"
    h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if config.COOKIE_SECURE:
        h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    path = request.url.path
    if path.startswith("/api/"):
        h["Cache-Control"] = "no-store"
    elif path.startswith("/uploads/"):
        h["Cache-Control"] = "public, max-age=604800"
    return response


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    # Never leak stack traces to the client
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.api_route("/health", methods=["GET", "HEAD"], tags=["system"])
@app.api_route("/api/health", methods=["GET", "HEAD"], tags=["system"])
async def health():
    """Lightweight keep-alive health check for UptimeRobot and Render."""
    return {"status": "ok", "service": "Trust Line Import HUB"}


@app.api_route("/health/db", methods=["GET", "HEAD"], tags=["system"])
@app.api_route("/api/health/db", methods=["GET", "HEAD"], tags=["system"])
def health_db():
    """Health check that runs a trivial query so the database stays active (Supabase free tier)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "database": "unreachable"})


app.include_router(auth.router)
app.include_router(public.router)
app.include_router(admin.router)

app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")
app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
