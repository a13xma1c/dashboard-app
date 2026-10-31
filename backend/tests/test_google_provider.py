"""
Google provider code paths, with the GA client and google-auth faked out.
No network access is ever attempted.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from google.analytics.data_v1beta.types import Filter
from google.api_core.exceptions import PermissionDenied

from app.providers import (
    GoogleAnalyticsProvider,
    credentials_from_session,
    get_provider,
    serialize_response,
)


def _fake_response(
    headers_dims: list[str], headers_metrics: list[str], rows: list[list[str]]
) -> SimpleNamespace:
    """Duck-typed stand-in for a ``RunReportResponse``."""
    return SimpleNamespace(
        dimension_headers=[SimpleNamespace(name=h) for h in headers_dims],
        metric_headers=[SimpleNamespace(name=h) for h in headers_metrics],
        rows=[
            SimpleNamespace(
                dimension_values=[SimpleNamespace(value=v) for v in r[: len(headers_dims)]],
                metric_values=[SimpleNamespace(value=v) for v in r[len(headers_dims) :]],
            )
            for r in rows
        ],
    )


def test_serialize_response_flattens_headers_and_rows() -> None:
    response = _fake_response(
        ["date"], ["sessions", "totalUsers"], [["20250301", "10", "8"], ["20250302", "12", "9"]]
    )
    assert serialize_response(response) == {
        "headers": ["date", "sessions", "totalUsers"],
        "rows": [["20250301", "10", "8"], ["20250302", "12", "9"]],
    }


def test_serialize_empty_response() -> None:
    assert serialize_response(_fake_response(["date"], ["sessions"], [])) == {
        "headers": ["date", "sessions"],
        "rows": [],
    }


def test_run_report_builds_request_and_serializes() -> None:
    client = MagicMock()
    client.run_report.return_value = _fake_response(["country"], ["sessions"], [["US", "5"]])
    provider = GoogleAnalyticsProvider(credentials=MagicMock(), client=client)

    result = provider.run_report("42", ["country"], ["sessions"], "7daysAgo", "yesterday", limit=50)

    assert result == {"headers": ["country", "sessions"], "rows": [["US", "5"]]}
    req = client.run_report.call_args.args[0]
    assert req.property == "properties/42"
    assert [d.name for d in req.dimensions] == ["country"]
    assert [m.name for m in req.metrics] == ["sessions"]
    assert req.date_ranges[0].start_date == "7daysAgo"
    assert req.date_ranges[0].end_date == "yesterday"
    assert req.limit == 50
    assert not req.dimension_filter.filter.field_name  # no filter set


def test_run_report_applies_exact_match_dimension_filter() -> None:
    client = MagicMock()
    client.run_report.return_value = _fake_response(["date"], ["sessions"], [])
    provider = GoogleAnalyticsProvider(credentials=MagicMock(), client=client)

    provider.run_report("42", ["date"], ["sessions"], dimension_filter=("deviceCategory", "mobile"))

    req = client.run_report.call_args.args[0]
    f = req.dimension_filter.filter
    assert f.field_name == "deviceCategory"
    assert f.string_filter.value == "mobile"
    assert f.string_filter.match_type == Filter.StringFilter.MatchType.EXACT


def test_google_api_error_becomes_502() -> None:
    client = MagicMock()
    client.run_report.side_effect = PermissionDenied("User does not have sufficient permissions")
    provider = GoogleAnalyticsProvider(credentials=MagicMock(), client=client)

    with pytest.raises(HTTPException) as exc_info:
        provider.run_report("42", ["date"], ["sessions"])
    assert exc_info.value.status_code == 502
    assert "permissions" in exc_info.value.detail


# ── Credentials ───────────────────────────────────────────────────────────────


def test_credentials_without_refresh_token_are_not_refreshed() -> None:
    with patch("app.providers.Credentials") as creds_cls:
        creds_cls.return_value.refresh_token = None
        session = {"token": "abc"}
        creds = credentials_from_session(session)
    creds.refresh.assert_not_called()


def test_credentials_refresh_updates_session_token() -> None:
    with patch("app.providers.Credentials") as creds_cls:
        fake = creds_cls.return_value
        fake.refresh_token = "r"

        def _refresh(_request: object) -> None:
            fake.token = "new-token"

        fake.refresh.side_effect = _refresh
        session = {"token": "old-token", "refresh_token": "r"}
        credentials_from_session(session)

    assert session["token"] == "new-token"


def test_failed_refresh_raises_401() -> None:
    with patch("app.providers.Credentials") as creds_cls:
        fake = creds_cls.return_value
        fake.refresh_token = "r"
        fake.refresh.side_effect = Exception("invalid_grant")
        with pytest.raises(HTTPException) as exc_info:
            credentials_from_session({"token": "t", "refresh_token": "r"})
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


# ── Wiring through the real-mode app ──────────────────────────────────────────


def test_real_mode_endpoint_uses_google_provider(real_app: FastAPI) -> None:
    """With mock mode off, the analytics router should hit the Google provider."""
    fake_provider = MagicMock()
    fake_provider.run_report.return_value = {"headers": ["date", "sessions"], "rows": [["20250301", "1"]]}

    # Bypass require_session + credential building by overriding the provider dependency.
    real_app.dependency_overrides[get_provider] = lambda: fake_provider
    client = TestClient(real_app)

    body = client.get(
        "/analytics/overview/99", params={"start_date": "2025-03-01", "end_date": "2025-03-01"}
    ).json()
    assert body == {"headers": ["date", "sessions"], "rows": [["20250301", "1"]]}
    kwargs = fake_provider.run_report.call_args.kwargs
    assert kwargs["dimensions"] == ["date"]
    assert kwargs["start_date"] == "2025-03-01"
    assert fake_provider.run_report.call_args.args[0] == "99"


def test_real_mode_builds_credentials_from_session(real_app: FastAPI) -> None:
    """End-to-end in real mode: session → credentials → GA client → response."""
    client = TestClient(real_app)
    # Real-mode sessions are only created by the OAuth callback, so fake the
    # token exchange and log in through it.
    login = client.get("/auth/login", follow_redirects=False)
    state = login.headers["location"].split("state=")[1].split("&")[0]
    with (
        patch("app.routers.auth.build_flow") as build_flow,
        patch("app.routers.auth.fetch_user_email", return_value=None),
    ):
        build_flow.return_value.credentials = MagicMock(
            token="t", refresh_token=None, token_uri="u", client_id="c", client_secret="s", scopes=[]
        )
        client.get(f"/auth/callback?code=x&state={state}", follow_redirects=False)
    assert client.get("/auth/me").json()["authenticated"] is True

    fake_client = MagicMock()
    fake_client.run_report.return_value = _fake_response(["deviceCategory"], ["sessions"], [["mobile", "3"]])

    with (
        patch("app.providers.BetaAnalyticsDataClient", return_value=fake_client),
        patch("app.providers.BetaAnalyticsDataRestTransport"),
    ):
        body = client.get("/analytics/devices/7").json()

    assert body["rows"] == [["mobile", "3"]]
    assert fake_client.run_report.call_args.args[0].property == "properties/7"
