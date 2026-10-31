import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.factory import create_app


def test_health_reports_mock_mode(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok", "mock_mode": True}


def test_health_in_real_mode(real_app: FastAPI) -> None:
    assert TestClient(real_app).get("/health").json() == {"status": "ok", "mock_mode": False}


def test_cors_allows_frontend_origin_with_credentials(client: TestClient) -> None:
    response = client.options(
        "/analytics/overview/1",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_rejects_unknown_origin(client: TestClient) -> None:
    response = client.options(
        "/analytics/overview/1",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in response.headers


def test_extra_cors_origins_are_honoured() -> None:
    app = create_app(Settings(session_secret="s", mock_mode=True, cors_origins=["http://127.0.0.1:5173"]))
    response = TestClient(app).get("/health", headers={"Origin": "http://127.0.0.1:5173"})
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_session_cookie_is_lax_and_http_only(client: TestClient) -> None:
    response = client.get("/auth/login", follow_redirects=False)
    cookie = response.headers["set-cookie"].lower()
    assert "samesite=lax" in cookie
    assert "httponly" in cookie


def test_openapi_documents_all_report_endpoints(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    for name in ("overview", "summary", "custom", "geo", "top-pages", "source-medium"):
        assert f"/analytics/{name}/{{property_id}}" in paths
    assert "/analytics/metadata" in paths


def test_create_app_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GA_MOCK_MODE", "true")
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    app = create_app()
    assert app.state.settings.mock_mode is True


def test_main_module_exposes_configured_app(monkeypatch: pytest.MonkeyPatch) -> None:
    import importlib

    monkeypatch.setenv("GA_MOCK_MODE", "true")
    import app.main as main_module

    reloaded = importlib.reload(main_module)
    assert reloaded.app.title == "GA Dashboard API"
