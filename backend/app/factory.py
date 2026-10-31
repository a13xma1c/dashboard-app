"""
FastAPI application factory.

``create_app`` builds a fully configured app from a ``Settings`` object, which
keeps this module importable without environment variables and lets tests spin
up isolated instances (mock mode on/off, different origins, …).
"""

from __future__ import annotations

import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.cache import ReportCache, build_cache
from app.config import Settings
from app.routers import analytics, auth

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None, cache: ReportCache | None = None) -> FastAPI:
    if settings is None:
        load_dotenv()
        settings = Settings.from_env()

    app = FastAPI(title="GA Dashboard API", version="2.1.0")
    app.state.settings = settings
    app.state.report_cache = cache or build_cache(settings.report_cache_ttl, settings.redis_url)

    # Middleware is applied in LIFO order by Starlette.
    # CORS must be the outermost layer so preflight requests are handled before
    # SessionMiddleware tries to read the cookie (which would fail on OPTIONS).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        same_site="lax",
        https_only=settings.session_https_only,
    )

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])

    @app.get("/health")
    def health() -> dict[str, object]:
        report_cache: ReportCache = app.state.report_cache
        return {
            "status": "ok",
            "version": app.version,
            "mock_mode": settings.mock_mode,
            "cache": {**report_cache.stats(), "reachable": report_cache.ping()},
        }

    if settings.mock_mode:
        logger.warning("GA_MOCK_MODE is enabled — serving generated analytics data.")

    return app
