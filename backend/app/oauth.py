"""
OAuth 2.0 helpers — build the authorization URL and exchange the code for tokens.
"""
from __future__ import annotations

from fastapi import HTTPException
from google_auth_oauthlib.flow import Flow

from app.config import Settings

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
