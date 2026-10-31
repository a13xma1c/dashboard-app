"""
Auth router — Google OAuth 2.0 flow, plus a short-circuit for mock mode.

In mock mode ``/auth/login`` simply marks the session as authenticated and
redirects back to the frontend, so the whole app can be exercised without
Google credentials.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from typing import Any

from app.config import Settings
from app.oauth import build_flow
from app.providers import get_settings
from app.schemas import AuthStatus

router = APIRouter()

MOCK_TOKEN = "mock-access-token"
MOCK_EMAIL = "demo@example.com"


def _dashboard_url(settings: Settings) -> str:
    return f"{settings.frontend_origin}/dashboard"


@router.get("/login")
def login(request: Request, settings: Settings = Depends(get_settings)) -> RedirectResponse:
    """Redirect the user to Google's OAuth consent screen (or straight in, in mock mode)."""
    if settings.mock_mode:
        request.session["token"] = MOCK_TOKEN
        request.session["email"] = MOCK_EMAIL
        return RedirectResponse(_dashboard_url(settings))

    flow = build_flow(settings)
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    request.session["oauth_state"] = state
    return RedirectResponse(authorization_url)


@router.get("/callback")
def callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """Exchange the authorization code for tokens and store them in the session."""
    if settings.mock_mode:
        request.session["token"] = MOCK_TOKEN
        request.session["email"] = MOCK_EMAIL
        return RedirectResponse(_dashboard_url(settings))

    if error:
        # User denied consent (or Google reported another error).
        return RedirectResponse(f"{settings.frontend_origin}/?error={error}")

    stored_state = request.session.pop("oauth_state", None)
    if not state or stored_state != state:
        raise HTTPException(status_code=400, detail="State mismatch — possible CSRF attack")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    flow = build_flow(settings)
    flow.fetch_token(code=code)
    credentials = flow.credentials

    request.session["token"] = credentials.token
    request.session["refresh_token"] = credentials.refresh_token
    request.session["token_uri"] = credentials.token_uri
    request.session["client_id"] = credentials.client_id
    request.session["client_secret"] = credentials.client_secret
    request.session["scopes"] = list(credentials.scopes or [])

    return RedirectResponse(_dashboard_url(settings))


@router.get("/me", response_model=AuthStatus)
def me(request: Request, settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """Return whether the user is authenticated and whether the API serves mock data."""
    authenticated = bool(request.session.get("token"))
    return {
        "authenticated": authenticated,
        "mock_mode": settings.mock_mode,
        "email": request.session.get("email") if authenticated else None,
    }


@router.post("/logout")
def logout(request: Request) -> dict[str, str]:
    """Clear the session."""
    request.session.clear()
    return {"status": "logged out"}
