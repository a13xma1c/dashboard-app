"""Tests for the deterministic mock GA data generator."""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from app.mock_data import (
    CATEGORICAL_DIMENSIONS,
    DERIVED_DIMENSIONS,
    METRIC_INFO,
    SUPPORTED_DIMENSIONS,
    SUPPORTED_METRICS,
    MockAnalyticsProvider,
    UnsupportedFieldError,
    metadata,
)

PID = "123456789"


def _sum(report: dict[str, Any], col: int) -> float:
    return sum(float(r[col]) for r in report["rows"])


# ── Shape ─────────────────────────────────────────────────────────────────────


def test_headers_match_requested_fields(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["country"], ["sessions", "totalUsers"])
    assert report["headers"] == ["country", "sessions", "totalUsers"]
    for row in report["rows"]:
        assert len(row) == 3
        assert all(isinstance(cell, str) for cell in row)


def test_date_dimension_yields_one_row_per_day_in_chronological_order(
    provider: MockAnalyticsProvider,
) -> None:
    report = provider.run_report(PID, ["date"], ["sessions"], "2025-03-01", "2025-03-10")
    dates = [r[0] for r in report["rows"]]
    assert dates == [f"202503{d:02d}" for d in range(1, 11)]


def test_relative_dates_are_resolved_against_injected_today(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["date"], ["sessions"], "2daysAgo", "today")
    assert [r[0] for r in report["rows"]] == ["20250313", "20250314", "20250315"]


def test_categorical_dimension_returns_every_known_value(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["deviceCategory"], ["sessions"])
    assert {r[0] for r in report["rows"]} == {"desktop", "mobile", "tablet"}


def test_categorical_rows_sorted_by_first_metric_descending(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["country"], ["sessions", "totalUsers"])
    sessions = [int(r[1]) for r in report["rows"]]
    assert sessions == sorted(sessions, reverse=True)


def test_no_dimensions_returns_single_totals_row(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, [], ["sessions", "totalUsers"])
    assert report["headers"] == ["sessions", "totalUsers"]
    assert len(report["rows"]) == 1
    assert int(report["rows"][0][0]) > 0


def test_multiple_dimensions_produce_cartesian_product(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["deviceCategory", "newVsReturning"], ["sessions"])
    n_devices = len(CATEGORICAL_DIMENSIONS["deviceCategory"])
    n_nvr = len(CATEGORICAL_DIMENSIONS["newVsReturning"])
    assert len(report["rows"]) == n_devices * n_nvr


def test_limit_truncates_rows(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["country"], ["sessions"], limit=5)
    assert len(report["rows"]) == 5


def test_integer_metrics_are_whole_numbers(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["date"], ["sessions", "screenPageViews"], "7daysAgo", "today")
    for row in report["rows"]:
        assert row[1].isdigit() and row[2].isdigit()


def test_rate_metrics_are_fractions(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["deviceCategory"], ["engagementRate", "bounceRate"])
    for _, er, br in report["rows"]:
        assert 0 < float(er) < 1
        assert 0 < float(br) < 1
        assert float(er) + float(br) == pytest.approx(1.0, abs=1e-5)


def test_average_duration_is_plausible_seconds(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, [], ["averageSessionDuration"])
    assert 30 < float(report["rows"][0][0]) < 600


# ── Determinism ───────────────────────────────────────────────────────────────


def test_same_inputs_same_output(provider: MockAnalyticsProvider) -> None:
    a = provider.run_report(PID, ["date", "deviceCategory"], ["sessions", "engagementRate"])
    b = MockAnalyticsProvider(today=date(2025, 3, 15)).run_report(
        PID, ["date", "deviceCategory"], ["sessions", "engagementRate"]
    )
    assert a == b


def test_different_properties_differ(provider: MockAnalyticsProvider) -> None:
    a = provider.run_report("111", ["date"], ["sessions"], "7daysAgo", "today")
    b = provider.run_report("222", ["date"], ["sessions"], "7daysAgo", "today")
    assert a != b


def test_requesting_more_metrics_does_not_change_existing_values(provider: MockAnalyticsProvider) -> None:
    a = provider.run_report(PID, ["country"], ["sessions"])
    b = provider.run_report(PID, ["country"], ["sessions", "totalUsers"])
    assert [r[:2] for r in b["rows"]] == a["rows"]


# ── Internal consistency ──────────────────────────────────────────────────────


def test_breakdowns_sum_to_time_series_total(provider: MockAnalyticsProvider) -> None:
    overview = provider.run_report(PID, ["date"], ["sessions"])
    total = _sum(overview, 1)
    for dim in ("deviceCategory", "sessionDefaultChannelGroup", "country", "pagePath"):
        breakdown = provider.run_report(PID, [dim], ["sessions"])
        # Only rounding differences are allowed (one per row).
        assert abs(_sum(breakdown, 1) - total) <= len(breakdown["rows"])


def test_filtered_time_series_matches_breakdown_row(provider: MockAnalyticsProvider) -> None:
    devices = provider.run_report(PID, ["deviceCategory"], ["sessions"])
    mobile_total = next(int(r[1]) for r in devices["rows"] if r[0] == "mobile")

    filtered = provider.run_report(PID, ["date"], ["sessions"], dimension_filter=("deviceCategory", "mobile"))
    assert abs(_sum(filtered, 1) - mobile_total) <= len(filtered["rows"])


def test_filter_on_unknown_value_returns_no_rows(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(
        PID, ["date"], ["sessions"], dimension_filter=("deviceCategory", "smart-fridge")
    )
    assert report["rows"] == []
    assert report["headers"] == ["date", "sessions"]


def test_filter_on_derived_dimension(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(
        PID, ["date"], ["sessions"], "7daysAgo", "today", dimension_filter=("date", "20250310")
    )
    assert [r[0] for r in report["rows"]] == ["20250310"]


def test_users_never_exceed_sessions(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["date"], ["sessions", "totalUsers", "newUsers"])
    for _, sessions, users, new_users in report["rows"]:
        assert int(new_users) <= int(users) <= int(sessions)


def test_weekends_are_quieter_on_average(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["date"], ["sessions"], "2025-01-01", "2025-03-15")
    weekday: list[int] = []
    weekend: list[int] = []
    for raw, sessions in report["rows"]:
        d = date(int(raw[:4]), int(raw[4:6]), int(raw[6:]))
        (weekend if d.weekday() >= 5 else weekday).append(int(sessions))
    assert sum(weekend) / len(weekend) < sum(weekday) / len(weekday)


# ── Derived dimensions ────────────────────────────────────────────────────────


def test_day_of_week_uses_ga_convention(provider: MockAnalyticsProvider) -> None:
    # 2025-03-09 is a Sunday → GA dayOfWeek "0".
    report = provider.run_report(PID, ["dayOfWeek"], ["sessions"], "2025-03-09", "2025-03-09")
    assert report["rows"][0][0] == "0"


def test_year_month_grouping(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["yearMonth"], ["sessions"], "2025-02-20", "2025-03-05")
    assert [r[0] for r in report["rows"]] == ["202502", "202503"]


def test_hour_dimension_has_24_values(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["hour"], ["sessions"])
    assert len(report["rows"]) == 24


# ── Validation ────────────────────────────────────────────────────────────────


def test_unknown_dimension_rejected(provider: MockAnalyticsProvider) -> None:
    with pytest.raises(UnsupportedFieldError, match="dimension"):
        provider.run_report(PID, ["notADimension"], ["sessions"])


def test_unknown_metric_rejected(provider: MockAnalyticsProvider) -> None:
    with pytest.raises(UnsupportedFieldError, match="metric"):
        provider.run_report(PID, ["date"], ["notAMetric"])


def test_empty_metrics_rejected(provider: MockAnalyticsProvider) -> None:
    with pytest.raises(UnsupportedFieldError):
        provider.run_report(PID, ["date"], [])


def test_unknown_filter_dimension_rejected(provider: MockAnalyticsProvider) -> None:
    with pytest.raises(UnsupportedFieldError, match="filter"):
        provider.run_report(PID, ["date"], ["sessions"], dimension_filter=("nope", "x"))


def test_invalid_date_propagates(provider: MockAnalyticsProvider) -> None:
    from app.dates import InvalidDateError

    with pytest.raises(InvalidDateError):
        provider.run_report(PID, ["date"], ["sessions"], "not-a-date", "today")


# ── Metadata ──────────────────────────────────────────────────────────────────


def test_metadata_covers_every_supported_field() -> None:
    meta = metadata()
    assert {d["name"] for d in meta["dimensions"]} == set(SUPPORTED_DIMENSIONS)
    assert {m["name"] for m in meta["metrics"]} == set(SUPPORTED_METRICS)
    assert all(d["label"] for d in meta["dimensions"])
    assert all(m["type"] in {"integer", "float", "percent", "seconds"} for m in meta["metrics"])


def test_every_metric_has_info() -> None:
    assert set(METRIC_INFO) == set(SUPPORTED_METRICS)


@pytest.mark.parametrize("dimension", sorted(SUPPORTED_DIMENSIONS))
def test_every_dimension_produces_rows(provider: MockAnalyticsProvider, dimension: str) -> None:
    report = provider.run_report(PID, [dimension], ["sessions"], "7daysAgo", "today")
    assert report["rows"], dimension
    if dimension in DERIVED_DIMENSIONS:
        assert report["rows"] == sorted(report["rows"], key=lambda r: r[0])


@pytest.mark.parametrize("metric", sorted(SUPPORTED_METRICS))
def test_every_metric_produces_numeric_values(provider: MockAnalyticsProvider, metric: str) -> None:
    report = provider.run_report(PID, ["deviceCategory"], [metric])
    for row in report["rows"]:
        assert float(row[1]) >= 0


# ── Hierarchy (city → country) ────────────────────────────────────────────────


def test_cities_filtered_by_country_sum_to_country_total(provider: MockAnalyticsProvider) -> None:
    geo = provider.run_report(PID, ["country"], ["sessions"])
    germany = next(int(r[1]) for r in geo["rows"] if r[0] == "Germany")
    cities = provider.run_report(PID, ["city"], ["sessions"], dimension_filter=("country", "Germany"))
    assert {r[0] for r in cities["rows"]} == {"Berlin", "Munich", "Hamburg"}
    assert abs(_sum(cities, 1) - germany) <= len(cities["rows"])


def test_all_cities_sum_to_all_countries(provider: MockAnalyticsProvider) -> None:
    geo = provider.run_report(PID, ["country"], ["sessions"])
    cities = provider.run_report(PID, ["city"], ["sessions"])
    assert abs(_sum(cities, 1) - _sum(geo, 1)) <= len(cities["rows"])


def test_country_city_combos_respect_hierarchy(provider: MockAnalyticsProvider) -> None:
    from app.mock_data import PARENT_OF

    report = provider.run_report(PID, ["country", "city"], ["sessions"])
    assert report["rows"]
    for country, city, _ in report["rows"]:
        assert PARENT_OF["city"][city] == country
    geo = provider.run_report(PID, ["country"], ["sessions"])
    assert abs(_sum(report, 2) - _sum(geo, 1)) <= len(report["rows"])


def test_child_filter_narrows_parent_dimension(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["country"], ["sessions"], dimension_filter=("city", "Berlin"))
    assert [r[0] for r in report["rows"]] == ["Germany"]
    berlin = provider.run_report(PID, ["city"], ["sessions"], dimension_filter=("city", "Berlin"))
    assert report["rows"][0][1] == berlin["rows"][0][1]


def test_filter_on_same_dimension_returns_only_that_value(provider: MockAnalyticsProvider) -> None:
    full = provider.run_report(PID, ["deviceCategory"], ["sessions"])
    mobile = next(r for r in full["rows"] if r[0] == "mobile")
    filtered = provider.run_report(
        PID, ["deviceCategory"], ["sessions"], dimension_filter=("deviceCategory", "mobile")
    )
    assert filtered["rows"] == [mobile]


def test_parent_filter_with_child_and_other_dimension(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(
        PID, ["city", "deviceCategory"], ["sessions"], dimension_filter=("country", "Germany")
    )
    assert {r[0] for r in report["rows"]} == {"Berlin", "Munich", "Hamburg"}
    geo = provider.run_report(PID, ["country"], ["sessions"])
    germany = next(int(r[1]) for r in geo["rows"] if r[0] == "Germany")
    assert abs(_sum(report, 2) - germany) <= len(report["rows"])


def test_parent_filter_on_unknown_country_yields_no_cities(provider: MockAnalyticsProvider) -> None:
    report = provider.run_report(PID, ["city"], ["sessions"], dimension_filter=("country", "Atlantis"))
    assert report["rows"] == []


def test_conditional_shares_for_unknown_parent_is_empty() -> None:
    from app.mock_data import _conditional_shares

    assert _conditional_shares(PID, "city", date(2025, 3, 1), "Atlantis") == {}


def test_conditional_shares_sum_to_one() -> None:
    from app.mock_data import _conditional_shares

    shares = _conditional_shares(PID, "city", date(2025, 3, 1), "Germany")
    assert set(shares) == {"Berlin", "Munich", "Hamburg"}
    assert sum(shares.values()) == pytest.approx(1.0)
