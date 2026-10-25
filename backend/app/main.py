"""Trust Line Import HUB - FastAPI application entry point."""
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .database import Base, engine
from .routers import admin, auth, public

Base.metadata.create_all(bind=engine)

SHOW_DOCS = os.getenv("SHOW_DOCS", "false").lower() == "true"

app = FastAPI(
    title="Trust Line Import HUB API",
    docs_url="/api/docs" if SHOW_DOCS else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if SHOW_DOCS else None,
)

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: blob:; "
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


app.include_router(auth.router)
app.include_router(public.router)
app.include_router(admin.router)

app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")
app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
