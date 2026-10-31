"""Auth router — mock mode short-circuit and the real OAuth code paths."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.factory import create_app

# ── Mock mode ─────────────────────────────────────────────────────────────────


def test_me_unauthenticated_reports_mock_mode(client: TestClient) -> None:
    body = client.get("/auth/me").json()
    assert body == {"authenticated": False, "mock_mode": True, "email": None}


def test_login_in_mock_mode_sets_session_and_redirects_to_dashboard(client: TestClient) -> None:
    response = client.get("/auth/login", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173/dashboard"
    assert "session" in response.cookies

    me = client.get("/auth/me").json()
    assert me["authenticated"] is True
    assert me["email"] == "demo@example.com"


def test_callback_in_mock_mode_also_logs_in(client: TestClient) -> None:
    response = client.get("/auth/callback", follow_redirects=False)
    assert response.status_code == 307
    assert client.get("/auth/me").json()["authenticated"] is True


def test_logout_clears_session(authed_client: TestClient) -> None:
    assert authed_client.get("/auth/me").json()["authenticated"] is True
    response = authed_client.post("/auth/logout")
    assert response.json() == {"status": "logged out"}
    assert authed_client.get("/auth/me").json()["authenticated"] is False


def test_login_redirect_uses_configured_frontend_origin() -> None:
    app = create_app(Settings(session_secret="s", mock_mode=True, frontend_origin="https://dash.example"))
    response = TestClient(app).get("/auth/login", follow_redirects=False)
    assert response.headers["location"] == "https://dash.example/dashboard"


# ── Real mode ─────────────────────────────────────────────────────────────────


def test_me_in_real_mode(real_app: FastAPI) -> None:
    body = TestClient(real_app).get("/auth/me").json()
    assert body["mock_mode"] is False
    assert body["authenticated"] is False


def test_login_redirects_to_google_and_stores_state(real_app: FastAPI) -> None:
    client = TestClient(real_app)
    response = client.get("/auth/login", follow_redirects=False)
    assert response.status_code == 307
    location = response.headers["location"]
    assert location.startswith("https://accounts.google.com/o/oauth2/auth")
    assert "client_id=client-id.apps.googleusercontent.com" in location
    assert "analytics.readonly" in location
    assert "state=" in location
    assert "access_type=offline" in location


def test_login_without_google_credentials_returns_503() -> None:
    app = create_app(Settings(session_secret="s", mock_mode=False))
    response = TestClient(app).get("/auth/login", follow_redirects=False)
    assert response.status_code == 503
    assert "GOOGLE_CLIENT_ID" in response.json()["detail"]


def test_callback_rejects_state_mismatch(real_app: FastAPI) -> None:
    client = TestClient(real_app)
    client.get("/auth/login", follow_redirects=False)  # stores a state in the session
    response = client.get("/auth/callback?code=abc&state=wrong", follow_redirects=False)
    assert response.status_code == 400
    assert "State mismatch" in response.json()["detail"]


def test_callback_without_prior_login_is_rejected(real_app: FastAPI) -> None:
    response = TestClient(real_app).get("/auth/callback?code=abc&state=x", follow_redirects=False)
    assert response.status_code == 400


def test_callback_with_error_param_redirects_to_login_page(real_app: FastAPI) -> None:
    response = TestClient(real_app).get("/auth/callback?error=access_denied", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173/?error=access_denied"


def test_callback_missing_code_is_rejected(real_app: FastAPI) -> None:
    client = TestClient(real_app)
    login = client.get("/auth/login", follow_redirects=False)
    state = login.headers["location"].split("state=")[1].split("&")[0]
    response = client.get(f"/auth/callback?state={state}", follow_redirects=False)
    assert response.status_code == 400
    assert "code" in response.json()["detail"].lower()


def test_successful_callback_stores_credentials_in_session(real_app: FastAPI) -> None:
    client = TestClient(real_app)
    login = client.get("/auth/login", follow_redirects=False)
    state = login.headers["location"].split("state=")[1].split("&")[0]

    fake_creds = MagicMock(
        token="access-token",
        refresh_token="refresh-token",
        token_uri="https://oauth2.googleapis.com/token",
        client_id="client-id.apps.googleusercontent.com",
        client_secret="client-secret",
        scopes=["openid"],
    )
    fake_flow = MagicMock()
    fake_flow.credentials = fake_creds

    with (
        patch("app.routers.auth.build_flow", return_value=fake_flow),
        patch("app.routers.auth.fetch_user_email", return_value="user@example.com") as fetch_email,
    ):
        response = client.get(f"/auth/callback?code=the-code&state={state}", follow_redirects=False)

    fake_flow.fetch_token.assert_called_once_with(code="the-code")
    fetch_email.assert_called_once_with("access-token")
    assert response.status_code == 307
    assert response.headers["location"].endswith("/dashboard")
    me = client.get("/auth/me").json()
    assert me["authenticated"] is True
    assert me["email"] == "user@example.com"


def test_callback_succeeds_even_if_userinfo_lookup_fails(real_app: FastAPI) -> None:
    client = TestClient(real_app)
    login = client.get("/auth/login", follow_redirects=False)
    state = login.headers["location"].split("state=")[1].split("&")[0]
    fake_flow = MagicMock()
    fake_flow.credentials = MagicMock(
        token="t", refresh_token=None, token_uri="u", client_id="c", client_secret="s", scopes=[]
    )

    with (
        patch("app.routers.auth.build_flow", return_value=fake_flow),
        patch("app.routers.auth.fetch_user_email", return_value=None),
    ):
        client.get(f"/auth/callback?code=x&state={state}", follow_redirects=False)

    me = client.get("/auth/me").json()
    assert me == {"authenticated": True, "mock_mode": False, "email": None}
