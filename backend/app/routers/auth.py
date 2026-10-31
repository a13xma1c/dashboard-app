from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from app.oauth import build_flow
import os

router = APIRouter()

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")


@router.get("/login")
def login(request: Request):
    """Redirect the user to Google's OAuth consent screen."""
    flow = build_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    request.session["oauth_state"] = state
    return RedirectResponse(authorization_url)


@router.get("/callback")
def callback(request: Request, code: str, state: str):
    """Exchange the authorization code for tokens and store them in the session."""
    stored_state = request.session.get("oauth_state")
    if stored_state != state:
        return {"error": "State mismatch — possible CSRF attack"}

    flow = build_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials

    request.session["token"] = credentials.token
    request.session["refresh_token"] = credentials.refresh_token
    request.session["token_uri"] = credentials.token_uri
    request.session["client_id"] = credentials.client_id
    request.session["client_secret"] = credentials.client_secret
    request.session["scopes"] = list(credentials.scopes or [])

    return RedirectResponse(f"{FRONTEND_ORIGIN}/dashboard")


@router.get("/me")
def me(request: Request):
    """Return whether the user is authenticated."""
    if "token" in request.session:
        return {"authenticated": True}
    return {"authenticated": False}


@router.post("/logout")
def logout(request: Request):
    """Clear the session."""
    request.session.clear()
    return {"status": "logged out"}
