"""
OAuth 2.0 helpers — build the authorization URL and exchange the code for tokens.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException
from google_auth_oauthlib.flow import Flow

from app.config import Settings

logger = logging.getLogger(__name__)

USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/analytics.readonly",
]


def _client_config(settings: Settings) -> dict[str, dict[str, object]]:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=503,
            detail=(
                "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and "
                "GOOGLE_CLIENT_SECRET, or enable GA_MOCK_MODE for local development."
            ),
        )
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uris": [settings.google_redirect_uri],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


def build_flow(settings: Settings) -> Flow:
    return Flow.from_client_config(
        _client_config(settings),
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )


def fetch_user_email(access_token: str, timeout: float = 5.0) -> str | None:
    """
    Look up the signed-in user's email via the OpenID ``userinfo`` endpoint.

    Best-effort: the dashboard works without it, so any failure is logged and
    ``None`` is returned rather than blocking the login.
    """
    try:
        response = httpx.get(
            USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=timeout,
        )
        response.raise_for_status()
        email = response.json().get("email")
        return email if isinstance(email, str) and email else None
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Could not fetch user info: %s", exc)
        return None
