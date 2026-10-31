"""
Analytics router — thin HTTP layer over a ``ReportProvider``.

Every report endpoint accepts the same query parameters:

* ``start_date`` / ``end_date`` — GA date syntax (``30daysAgo``, ``today``, ``YYYY-MM-DD``)
* ``filter_dimension`` + ``filter_value`` — optional exact-match dimension filter,
  used by the UI for drill-downs (e.g. sessions over time for ``deviceCategory=mobile``)
* ``limit`` — max rows

All endpoints require an authenticated session (enforced by ``get_provider``).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.config import Settings
from app.dates import DateRange, InvalidDateError
from app.mock_data import UnsupportedFieldError
from app.mock_data import metadata as field_metadata
from app.providers import ReportProvider, get_provider, get_settings
from app.schemas import ReportResponse, SummaryResponse

router = APIRouter()

MAX_LIMIT = 10_000
MAX_CUSTOM_FIELDS = 5

#: GA4 property IDs are numeric (e.g. ``123456789``); reject anything else before it reaches Google.
PropertyId = Annotated[str, Path(pattern=r"^\d{1,20}$", description="Numeric GA4 property ID")]

# Metrics included in the period-over-period summary.
SUMMARY_METRICS = [
    "sessions",
    "totalUsers",
    "newUsers",
    "screenPageViews",
    "averageSessionDuration",
    "engagementRate",
]


# ── Shared query parameters ───────────────────────────────────────────────────


@dataclass
class ReportParams:
    start_date: str = "30daysAgo"
    end_date: str = "today"
    filter_dimension: str | None = None
    filter_value: str | None = None
    limit: int = 1000
    #: Reference date for relative ranges; ``None`` = the real clock. Set in mock mode via MOCK_TODAY.
    today: date | None = None

    @property
    def dimension_filter(self) -> tuple[str, str] | None:
        if self.filter_dimension:
            return (self.filter_dimension, self.filter_value or "")
        return None


def report_params(
    start_date: str = Query("30daysAgo", description="GA date: YYYY-MM-DD, today, yesterday, NdaysAgo"),
    end_date: str = Query("today", description="GA date: YYYY-MM-DD, today, yesterday, NdaysAgo"),
    filter_dimension: str | None = Query(None, description="Dimension to filter on (exact match)"),
    filter_value: str | None = Query(None, description="Value the filter dimension must equal"),
    limit: int = Query(1000, ge=1, le=MAX_LIMIT),
    settings: Settings = Depends(get_settings),
) -> ReportParams:
    today = settings.mock_today if settings.mock_mode else None

    # Validate dates up-front so every endpoint returns a consistent 400.
    try:
        DateRange.parse(start_date, end_date, today)
    except InvalidDateError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if filter_value is not None and not filter_dimension:
        raise HTTPException(status_code=400, detail="filter_value requires filter_dimension")

    return ReportParams(start_date, end_date, filter_dimension, filter_value, limit, today)


def _run(
    provider: ReportProvider,
    property_id: str,
    dimensions: list[str],
    metrics: list[str],
    params: ReportParams,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, Any]:
    try:
        return provider.run_report(
            property_id,
            dimensions=dimensions,
            metrics=metrics,
            start_date=start_date or params.start_date,
            end_date=end_date or params.end_date,
            dimension_filter=params.dimension_filter,
            limit=params.limit,
        )
    except UnsupportedFieldError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── Metadata ──────────────────────────────────────────────────────────────────


@router.get("/metadata")
def metadata(_: ReportProvider = Depends(get_provider)) -> dict[str, Any]:
    """Dimensions and metrics available to the custom report builder."""
    return field_metadata()


# ── Summary (KPIs with period-over-period comparison) ─────────────────────────


@router.get("/summary/{property_id}", response_model=SummaryResponse)
def summary(
    property_id: PropertyId,
    params: ReportParams = Depends(report_params),
    provider: ReportProvider = Depends(get_provider),
) -> dict[str, Any]:
    """Headline metrics for the selected range and the equal-length preceding range."""
    current_range = DateRange.parse(params.start_date, params.end_date, params.today)
    previous_range = current_range.previous()

    current = _run(provider, property_id, [], SUMMARY_METRICS, params)
    previous = _run(
        provider,
        property_id,
        [],
        SUMMARY_METRICS,
        params,
        start_date=previous_range.start.isoformat(),
        end_date=previous_range.end.isoformat(),
    )

    return {
        "metrics": SUMMARY_METRICS,
        "current": _totals(current),
        "previous": _totals(previous),
        "current_range": current_range.to_dict(),
        "previous_range": previous_range.to_dict(),
    }


def _totals(report: dict[str, Any]) -> dict[str, float]:
    """Turn a dimensionless report (0 or 1 rows) into ``{metric: number}``."""
    headers: list[str] = report["headers"]
    rows: list[list[str]] = report["rows"]
    values = rows[0] if rows else ["0"] * len(headers)
    return {h: _to_number(v) for h, v in zip(headers, values, strict=True)}


def _to_number(value: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


# ── Standard reports ──────────────────────────────────────────────────────────
# Each endpoint is a fixed (dimensions, metrics) pair; the date range and
# optional filter come from the shared query parameters.


def _standard_report(
    path: str, dimensions: list[str], metrics: list[str], doc: str
) -> Callable[..., dict[str, Any]]:
    @router.get(f"/{path}/{{property_id}}", response_model=ReportResponse, name=path)
    def endpoint(
        property_id: PropertyId,
        params: ReportParams = Depends(report_params),
        provider: ReportProvider = Depends(get_provider),
    ) -> dict[str, Any]:
        return _run(provider, property_id, dimensions, metrics, params)

    endpoint.__doc__ = doc
    endpoint.__name__ = path.replace("-", "_")
    return endpoint


overview = _standard_report(
    "overview",
    ["date"],
    ["sessions", "totalUsers", "newUsers", "screenPageViews", "engagedSessions", "averageSessionDuration"],
    "Daily sessions, users, new users, views, engaged sessions and avg. duration.",
)
traffic_sources = _standard_report(
    "traffic-sources",
    ["sessionDefaultChannelGroup"],
    ["sessions", "totalUsers", "engagementRate"],
    "Sessions broken down by default channel group.",
)
source_medium = _standard_report(
    "source-medium",
    ["sessionSource", "sessionMedium"],
    ["sessions", "totalUsers", "newUsers", "engagementRate"],
    "Sessions broken down by source / medium.",
)
top_pages = _standard_report(
    "top-pages",
    ["pagePath"],
    ["screenPageViews", "sessions", "averageSessionDuration", "bounceRate"],
    "Pages ranked by views.",
)
landing_pages = _standard_report(
    "landing-pages",
    ["landingPage"],
    ["sessions", "newUsers", "engagementRate", "conversions"],
    "Landing pages ranked by sessions.",
)
devices = _standard_report(
    "devices",
    ["deviceCategory"],
    ["sessions", "totalUsers", "engagementRate"],
    "Sessions broken down by device category.",
)
browsers = _standard_report(
    "browsers",
    ["browser"],
    ["sessions", "totalUsers"],
    "Sessions broken down by browser.",
)
operating_systems = _standard_report(
    "operating-systems",
    ["operatingSystem"],
    ["sessions", "totalUsers"],
    "Sessions broken down by operating system.",
)
new_vs_returning = _standard_report(
    "new-vs-returning",
    ["newVsReturning"],
    ["sessions", "totalUsers", "engagementRate"],
    "Sessions from new vs returning visitors.",
)
geo = _standard_report(
    "geo",
    ["country"],
    ["sessions", "totalUsers", "newUsers", "engagementRate"],
    "Sessions by country.",
)
cities = _standard_report(
    "cities",
    ["city"],
    ["sessions", "totalUsers"],
    "Sessions by city.",
)
events = _standard_report(
    "events",
    ["eventName"],
    ["eventCount", "totalUsers"],
    "Event counts by event name.",
)
hourly = _standard_report(
    "hourly",
    ["hour"],
    ["sessions", "totalUsers"],
    "Sessions by hour of day.",
)


# ── Custom report ─────────────────────────────────────────────────────────────


@router.get("/custom/{property_id}", response_model=ReportResponse)
def custom(
    property_id: PropertyId,
    dimensions: str = Query("date", description="Comma-separated dimension names"),
    metrics: str = Query("sessions", description="Comma-separated metric names"),
    params: ReportParams = Depends(report_params),
    provider: ReportProvider = Depends(get_provider),
) -> dict[str, Any]:
    """Run an arbitrary GA report."""
    dims = _split_fields(dimensions)
    mets = _split_fields(metrics)

    if not mets:
        raise HTTPException(status_code=400, detail="At least one metric is required")
    if len(dims) > MAX_CUSTOM_FIELDS or len(mets) > MAX_CUSTOM_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"At most {MAX_CUSTOM_FIELDS} dimensions and {MAX_CUSTOM_FIELDS} metrics are allowed",
        )

    return _run(provider, property_id, dims, mets, params)


def _split_fields(raw: str) -> list[str]:
    """Split a comma-separated field list, dropping blanks and duplicates."""
    return list(dict.fromkeys(f.strip() for f in raw.split(",") if f.strip()))
