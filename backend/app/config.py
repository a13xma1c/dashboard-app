"""
Application settings, loaded from environment variables.

Keeping configuration in one typed object (instead of scattered ``os.environ``
lookups) makes the app factory testable: tests construct a ``Settings`` directly
and never need to touch the process environment.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date

logger = logging.getLogger(__name__)

_TRUTHY = {"1", "true", "yes", "on"}

# Used only when GA_MOCK_MODE is enabled and no SESSION_SECRET is configured.
INSECURE_DEV_SECRET = "insecure-dev-secret-do-not-use-in-production"


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in _TRUTHY


@dataclass(frozen=True)
class Settings:
    session_secret: str
    frontend_origin: str = "http://localhost:5173"
    mock_mode: bool = False
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://localhost:8000/auth/callback"
    cors_origins: list[str] = field(default_factory=list)
    #: Mark the session cookie ``Secure`` — turn on behind HTTPS in production.
    session_https_only: bool = False
    #: Freeze "today" for the mock provider (reproducible demos / screenshots).
    mock_today: date | None = None
    #: Seconds to cache Google report responses per user; 0 disables caching.
    report_cache_ttl: int = 300

    @property
    def allowed_origins(self) -> list[str]:
        origins = [self.frontend_origin, *self.cors_origins]
        # de-duplicate while preserving order
        return list(dict.fromkeys(o for o in origins if o))

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        """
        Build settings from ``env`` (defaults to ``os.environ``).

        Raises ``RuntimeError`` when ``SESSION_SECRET`` is missing outside of
        mock mode — silently falling back to a known secret would be a
        security hole in a real deployment.
        """
        source: Mapping[str, str] = os.environ if env is None else env
        mock_mode = _as_bool(source.get("GA_MOCK_MODE"))

        secret = source.get("SESSION_SECRET", "").strip()
        if not secret:
            if not mock_mode:
                raise RuntimeError(
                    "SESSION_SECRET is not set. Generate one with "
                    '`python -c "import secrets; print(secrets.token_hex(32))"` '
                    "or set GA_MOCK_MODE=true for local development with mock data."
                )
            logger.warning(
                "SESSION_SECRET not set — using an insecure development secret "
                "because GA_MOCK_MODE is enabled."
            )
            secret = INSECURE_DEV_SECRET

        extra_origins = [o.strip() for o in source.get("CORS_ORIGINS", "").split(",") if o.strip()]

        mock_today_raw = source.get("MOCK_TODAY", "").strip()
        try:
            mock_today = date.fromisoformat(mock_today_raw) if mock_today_raw else None
        except ValueError as exc:
            raise RuntimeError(f"MOCK_TODAY must be YYYY-MM-DD, got {mock_today_raw!r}") from exc

        ttl_raw = source.get("REPORT_CACHE_TTL", "300").strip()
        try:
            report_cache_ttl = max(0, int(ttl_raw))
        except ValueError as exc:
            raise RuntimeError(
                f"REPORT_CACHE_TTL must be an integer number of seconds, got {ttl_raw!r}"
            ) from exc

        return cls(
            session_secret=secret,
            frontend_origin=source.get("FRONTEND_ORIGIN", "http://localhost:5173"),
            mock_mode=mock_mode,
            google_client_id=source.get("GOOGLE_CLIENT_ID") or None,
            google_client_secret=source.get("GOOGLE_CLIENT_SECRET") or None,
            google_redirect_uri=source.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback"),
            cors_origins=extra_origins,
            session_https_only=_as_bool(source.get("SESSION_HTTPS_ONLY")),
            mock_today=mock_today,
            report_cache_ttl=report_cache_ttl,
        )
