"""
Analytics router — wraps the GA Data API v1 (runReport).
All endpoints require the user to be authenticated (token stored in session).
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Request
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.services.beta_analytics_data.transports import BetaAnalyticsDataRestTransport
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
)
from google.api_core.exceptions import GoogleAPIError
from typing import Any

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_credentials(request: Request) -> Credentials:
    """Reconstruct credentials from session and refresh the token if expired."""
    token = request.session.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    creds = Credentials(
        token=token,
        refresh_token=request.session.get("refresh_token"),
        token_uri=request.session.get("token_uri"),
        client_id=request.session.get("client_id"),
        client_secret=request.session.get("client_secret"),
        scopes=request.session.get("scopes"),
    )

    # Refresh if expired (token is always treated as potentially stale since
    # we don't store expiry — refresh is a no-op when the token is still valid).
    if creds.refresh_token:
        try:
            creds.refresh(GoogleRequest())
            # Persist the new token back into the session.
            request.session["token"] = creds.token
        except Exception as exc:
            logger.warning("Token refresh failed: %s", exc)
            raise HTTPException(status_code=401, detail="Session expired — please log in again")

    return creds


def _run_report(
    credentials: Credentials,
    property_id: str,
    dimensions: list[str],
    metrics: list[str],
    start_date: str = "30daysAgo",
    end_date: str = "today",
) -> dict[str, Any]:
    # Use the REST transport explicitly — avoids gRPC channel issues with
    # short-lived OAuth user credentials and removes the need for grpcio.
    transport = BetaAnalyticsDataRestTransport(credentials=credentials)
    client = BetaAnalyticsDataClient(transport=transport)
    req = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name=d) for d in dimensions],
        metrics=[Metric(name=m) for m in metrics],
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
    )
    try:
        response = client.run_report(req)
    except GoogleAPIError as exc:
        logger.error("GA API error: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))

    headers = [h.name for h in response.dimension_headers] + [
        h.name for h in response.metric_headers
    ]
    rows = []
    for row in response.rows:
        rows.append(
            [dv.value for dv in row.dimension_values]
            + [mv.value for mv in row.metric_values]
        )

    return {"headers": headers, "rows": rows}


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview/{property_id}")
def overview(property_id: str, request: Request):
    """Sessions, users, pageviews for the last 30 days (daily)."""
    creds = _get_credentials(request)
    return _run_report(
        creds,
        property_id,
        dimensions=["date"],
        metrics=["sessions", "totalUsers", "screenPageViews"],
    )


# ── Traffic sources ───────────────────────────────────────────────────────────

@router.get("/traffic-sources/{property_id}")
def traffic_sources(property_id: str, request: Request):
    """Sessions broken down by session default channel group."""
    creds = _get_credentials(request)
    return _run_report(
        creds,
        property_id,
        dimensions=["sessionDefaultChannelGroup"],
        metrics=["sessions"],
    )


# ── Top pages ─────────────────────────────────────────────────────────────────

@router.get("/top-pages/{property_id}")
def top_pages(property_id: str, request: Request):
    """Top 20 pages by screen page views."""
    creds = _get_credentials(request)
    return _run_report(
        creds,
        property_id,
        dimensions=["pagePath"],
        metrics=["screenPageViews", "averageSessionDuration"],
    )


# ── Devices ───────────────────────────────────────────────────────────────────

@router.get("/devices/{property_id}")
def devices(property_id: str, request: Request):
    """Sessions broken down by device category."""
    creds = _get_credentials(request)
    return _run_report(
        creds,
        property_id,
        dimensions=["deviceCategory"],
        metrics=["sessions"],
    )


# ── Geo ───────────────────────────────────────────────────────────────────────

@router.get("/geo/{property_id}")
def geo(property_id: str, request: Request):
    """Sessions by country."""
    creds = _get_credentials(request)
    return _run_report(
        creds,
        property_id,
        dimensions=["country"],
        metrics=["sessions", "totalUsers"],
    )


# ── Custom report ─────────────────────────────────────────────────────────────

@router.get("/custom/{property_id}")
def custom(
    property_id: str,
    request: Request,
    dimensions: str = "date",
    metrics: str = "sessions",
    start_date: str = "30daysAgo",
    end_date: str = "today",
):
    """Run an arbitrary GA report. Pass comma-separated dimension/metric names."""
    creds = _get_credentials(request)
    return _run_report(
        creds,
        property_id,
        dimensions=dimensions.split(","),
        metrics=metrics.split(","),
        start_date=start_date,
        end_date=end_date,
    )
