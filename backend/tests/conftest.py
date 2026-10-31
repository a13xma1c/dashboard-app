"""
Shared fixtures.

* ``mock_settings`` / ``mock_app`` / ``client`` — app in GA_MOCK_MODE (no Google calls)
* ``authed_client`` — same, after logging in through ``/auth/login``
* ``real_app`` — app with mock mode OFF, for exercising the Google code paths
  with fakes injected via ``dependency_overrides``.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.factory import create_app
from app.mock_data import (
    MockAnalyticsProvider,
    _conditional_shares,
    _daily_sessions,
    _property_profile,
    _shares,
)

FROZEN_TODAY = date(2025, 3, 15)


@pytest.fixture(autouse=True)
def _clear_caches() -> Iterator[None]:
    """Keep lru_caches from leaking state/size between tests."""
    yield
    _daily_sessions.cache_clear()
    _shares.cache_clear()
    _conditional_shares.cache_clear()
    _property_profile.cache_clear()


@pytest.fixture
def mock_settings() -> Settings:
    return Settings(session_secret="test-secret", mock_mode=True)


@pytest.fixture
def real_settings() -> Settings:
    return Settings(
        session_secret="test-secret",
        mock_mode=False,
        google_client_id="client-id.apps.googleusercontent.com",
        google_client_secret="client-secret",
    )


@pytest.fixture
def mock_app(mock_settings: Settings) -> FastAPI:
    return create_app(mock_settings)


@pytest.fixture
def real_app(real_settings: Settings) -> FastAPI:
    return create_app(real_settings)


@pytest.fixture
def client(mock_app: FastAPI) -> TestClient:
    return TestClient(mock_app)


@pytest.fixture
def authed_client(client: TestClient) -> TestClient:
    response = client.get("/auth/login", follow_redirects=False)
    assert response.status_code in (302, 307)
    return client


@pytest.fixture
def provider() -> MockAnalyticsProvider:
    return MockAnalyticsProvider(today=FROZEN_TODAY)
