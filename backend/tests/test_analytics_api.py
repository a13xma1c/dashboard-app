"""Analytics endpoints, exercised through HTTP against the mock provider."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.routers.analytics import SUMMARY_METRICS

PID = "123456789"

STANDARD_REPORTS = {
    "overview": ["date"],
    "traffic-sources": ["sessionDefaultChannelGroup"],
    "source-medium": ["sessionSource", "sessionMedium"],
    "top-pages": ["pagePath"],
    "landing-pages": ["landingPage"],
    "devices": ["deviceCategory"],
    "browsers": ["browser"],
    "operating-systems": ["operatingSystem"],
    "new-vs-returning": ["newVsReturning"],
    "geo": ["country"],
    "cities": ["city"],
    "events": ["eventName"],
    "hourly": ["hour"],
}


# ── Auth gate ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "path",
    [f"/analytics/{name}/{PID}" for name in STANDARD_REPORTS]
    + [f"/analytics/summary/{PID}", f"/analytics/custom/{PID}", "/analytics/metadata"],
)
def test_endpoints_require_authentication(client: TestClient, path: str) -> None:
    response = client.get(path)
    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


# ── Standard reports ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("name, dimensions", STANDARD_REPORTS.items())
def test_standard_report_shape(authed_client: TestClient, name: str, dimensions: list[str]) -> None:
    response = authed_client.get(f"/analytics/{name}/{PID}")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["headers"][: len(dimensions)] == dimensions
    assert len(body["headers"]) > len(dimensions)
    assert body["rows"]
    assert all(len(row) == len(body["headers"]) for row in body["rows"])


def test_overview_respects_date_range(authed_client: TestClient) -> None:
    body = authed_client.get(
        f"/analytics/overview/{PID}", params={"start_date": "2025-03-01", "end_date": "2025-03-07"}
    ).json()
    assert [r[0] for r in body["rows"]] == [f"2025030{d}" for d in range(1, 8)]


def test_overview_default_range_is_last_30_days(authed_client: TestClient) -> None:
    body = authed_client.get(f"/analytics/overview/{PID}").json()
    assert len(body["rows"]) == 31  # 30daysAgo..today inclusive
    assert body["rows"][-1][0] == date.today().strftime("%Y%m%d")


def test_dimension_filter_is_applied(authed_client: TestClient) -> None:
    devices = authed_client.get(f"/analytics/devices/{PID}").json()
    tablet = next(int(r[1]) for r in devices["rows"] if r[0] == "tablet")

    filtered = authed_client.get(
        f"/analytics/overview/{PID}",
        params={"filter_dimension": "deviceCategory", "filter_value": "tablet"},
    ).json()
    total = sum(int(r[1]) for r in filtered["rows"])
    assert abs(total - tablet) <= len(filtered["rows"])


def test_limit_is_applied(authed_client: TestClient) -> None:
    body = authed_client.get(f"/analytics/geo/{PID}", params={"limit": 3}).json()
    assert len(body["rows"]) == 3


@pytest.mark.parametrize("limit", [0, -1, 10_001])
def test_limit_out_of_bounds_is_rejected(authed_client: TestClient, limit: int) -> None:
    response = authed_client.get(f"/analytics/geo/{PID}", params={"limit": limit})
    assert response.status_code == 422


def test_invalid_date_returns_400(authed_client: TestClient) -> None:
    response = authed_client.get(f"/analytics/overview/{PID}", params={"start_date": "lastTuesday"})
    assert response.status_code == 400
    assert "Invalid date" in response.json()["detail"]


def test_inverted_range_returns_400(authed_client: TestClient) -> None:
    response = authed_client.get(
        f"/analytics/overview/{PID}", params={"start_date": "today", "end_date": "7daysAgo"}
    )
    assert response.status_code == 400
    assert "must not be after" in response.json()["detail"]


def test_filter_value_without_dimension_returns_400(authed_client: TestClient) -> None:
    response = authed_client.get(f"/analytics/overview/{PID}", params={"filter_value": "x"})
    assert response.status_code == 400


def test_unknown_filter_dimension_returns_400(authed_client: TestClient) -> None:
    response = authed_client.get(
        f"/analytics/overview/{PID}", params={"filter_dimension": "bogus", "filter_value": "x"}
    )
    assert response.status_code == 400
    assert "Unsupported filter dimension" in response.json()["detail"]


# ── Summary ───────────────────────────────────────────────────────────────────


def test_summary_shape(authed_client: TestClient) -> None:
    body = authed_client.get(f"/analytics/summary/{PID}").json()
    assert body["metrics"] == SUMMARY_METRICS
    assert set(body["current"]) == set(SUMMARY_METRICS)
    assert set(body["previous"]) == set(SUMMARY_METRICS)
    assert body["current"]["sessions"] > 0
    assert body["previous"]["sessions"] > 0
    assert 0 < body["current"]["engagementRate"] < 1


def test_summary_periods_are_adjacent_and_equal_length(authed_client: TestClient) -> None:
    body = authed_client.get(
        f"/analytics/summary/{PID}", params={"start_date": "2025-03-08", "end_date": "2025-03-14"}
    ).json()
    assert body["current_range"] == {"start_date": "2025-03-08", "end_date": "2025-03-14"}
    assert body["previous_range"] == {"start_date": "2025-03-01", "end_date": "2025-03-07"}


def test_summary_totals_match_overview_sum(authed_client: TestClient) -> None:
    params = {"start_date": "2025-03-01", "end_date": "2025-03-14"}
    summary = authed_client.get(f"/analytics/summary/{PID}", params=params).json()
    overview = authed_client.get(f"/analytics/overview/{PID}", params=params).json()
    idx = overview["headers"].index("sessions")
    overview_total = sum(int(r[idx]) for r in overview["rows"])
    assert abs(summary["current"]["sessions"] - overview_total) <= len(overview["rows"])


def test_summary_with_relative_dates(authed_client: TestClient) -> None:
    body = authed_client.get(f"/analytics/summary/{PID}", params={"start_date": "6daysAgo"}).json()
    today = date.today()
    assert body["current_range"]["end_date"] == today.isoformat()
    assert body["current_range"]["start_date"] == (today - timedelta(days=6)).isoformat()
    assert body["previous_range"]["end_date"] == (today - timedelta(days=7)).isoformat()


# ── Custom ────────────────────────────────────────────────────────────────────


def test_custom_default_is_sessions_by_date(authed_client: TestClient) -> None:
    body = authed_client.get(f"/analytics/custom/{PID}").json()
    assert body["headers"] == ["date", "sessions"]


def test_custom_with_multiple_fields(authed_client: TestClient) -> None:
    body = authed_client.get(
        f"/analytics/custom/{PID}",
        params={"dimensions": "country, deviceCategory", "metrics": "sessions,engagementRate", "limit": 10},
    ).json()
    assert body["headers"] == ["country", "deviceCategory", "sessions", "engagementRate"]
    assert len(body["rows"]) == 10


def test_custom_with_no_dimensions(authed_client: TestClient) -> None:
    body = authed_client.get(
        f"/analytics/custom/{PID}", params={"dimensions": "", "metrics": "sessions"}
    ).json()
    assert body["headers"] == ["sessions"]
    assert len(body["rows"]) == 1


def test_custom_deduplicates_fields(authed_client: TestClient) -> None:
    body = authed_client.get(
        f"/analytics/custom/{PID}", params={"dimensions": "date,date", "metrics": "sessions,sessions"}
    ).json()
    assert body["headers"] == ["date", "sessions"]


def test_custom_unknown_dimension_returns_400(authed_client: TestClient) -> None:
    response = authed_client.get(f"/analytics/custom/{PID}", params={"dimensions": "galaxy"})
    assert response.status_code == 400
    assert "Unsupported dimension" in response.json()["detail"]


def test_custom_unknown_metric_returns_400(authed_client: TestClient) -> None:
    response = authed_client.get(f"/analytics/custom/{PID}", params={"metrics": "vibes"})
    assert response.status_code == 400
    assert "Unsupported metric" in response.json()["detail"]


def test_custom_requires_a_metric(authed_client: TestClient) -> None:
    response = authed_client.get(f"/analytics/custom/{PID}", params={"metrics": " , "})
    assert response.status_code == 400


def test_custom_caps_field_count(authed_client: TestClient) -> None:
    response = authed_client.get(
        f"/analytics/custom/{PID}",
        params={"dimensions": "date,country,city,deviceCategory,browser,operatingSystem"},
    )
    assert response.status_code == 400
    assert "At most" in response.json()["detail"]


# ── Metadata ──────────────────────────────────────────────────────────────────


def test_metadata_lists_fields(authed_client: TestClient) -> None:
    body = authed_client.get("/analytics/metadata").json()
    dimension_names = {d["name"] for d in body["dimensions"]}
    metric_names = {m["name"] for m in body["metrics"]}
    assert {"date", "country", "deviceCategory", "pagePath"} <= dimension_names
    assert {"sessions", "totalUsers", "engagementRate"} <= metric_names


# ── Helpers ───────────────────────────────────────────────────────────────────


def test_totals_handles_empty_and_non_numeric_reports() -> None:
    from app.routers.analytics import _totals

    assert _totals({"headers": ["sessions", "totalUsers"], "rows": []}) == {
        "sessions": 0.0,
        "totalUsers": 0.0,
    }
    assert _totals({"headers": ["sessions"], "rows": [["n/a"]]}) == {"sessions": 0.0}
    assert _totals({"headers": ["sessions"], "rows": [["12"]]}) == {"sessions": 12.0}


# ── Property ID validation ────────────────────────────────────────────────────


@pytest.mark.parametrize("bad_id", ["abc", "123abc", "12 34", "-1", "1" * 21])
def test_non_numeric_property_id_is_rejected(authed_client: TestClient, bad_id: str) -> None:
    response = authed_client.get(f"/analytics/overview/{bad_id}")
    assert response.status_code == 422
    response = authed_client.get(f"/analytics/summary/{bad_id}")
    assert response.status_code == 422
    response = authed_client.get(f"/analytics/custom/{bad_id}")
    assert response.status_code == 422


def test_numeric_property_id_is_accepted(authed_client: TestClient) -> None:
    assert authed_client.get("/analytics/devices/1").status_code == 200
    assert authed_client.get("/analytics/devices/98765432109876543210").status_code == 200


# ── Frozen mock clock ─────────────────────────────────────────────────────────


def test_mock_today_freezes_relative_dates() -> None:
    from datetime import date

    from app.config import Settings
    from app.factory import create_app

    app = create_app(Settings(session_secret="s", mock_mode=True, mock_today=date(2025, 3, 15)))
    client = TestClient(app)
    client.get("/auth/login", follow_redirects=False)
    body = client.get(f"/analytics/overview/{PID}", params={"start_date": "2daysAgo"}).json()
    assert [r[0] for r in body["rows"]] == ["20250313", "20250314", "20250315"]
    summary = client.get(f"/analytics/summary/{PID}", params={"start_date": "6daysAgo"}).json()
    assert summary["current_range"] == {"start_date": "2025-03-09", "end_date": "2025-03-15"}
