"""
Report providers — the single seam between the HTTP layer and the data source.

``ReportProvider`` is a structural protocol implemented by:

* ``GoogleAnalyticsProvider`` — talks to the GA Data API v1 with the OAuth
  credentials stored in the user's session.
* ``MockAnalyticsProvider`` (see ``mock_data.py``) — deterministic local data.

``get_provider`` is a FastAPI dependency that picks one based on settings, so
routers never know which backend they're talking to and tests can override it.
"""
from __future__ import annotations

import logging
from typing import Any, Protocol

from fastapi import Depends, HTTPException, Request
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.services.beta_analytics_data.transports import (
    BetaAnalyticsDataRestTransport,
)
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Filter,
    FilterExpression,
    Metric,
    RunReportRequest,
)
from google.api_core.exceptions import GoogleAPIError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials

from app.config import Settings
from app.mock_data import MockAnalyticsProvider

logger = logging.getLogger(__name__)

ReportResult = dict[str, Any]


class ReportProvider(Protocol):
    name: str

    def run_report(
        self,
        property_id: str,
        dimensions: list[str],
        metrics: list[str],
        start_date: str = "30daysAgo",
        end_date: str = "today",
        dimension_filter: tuple[str, str] | None = None,
        limit: int = 1000,
    ) -> ReportResult: ...


# ── Session helpers ───────────────────────────────────────────────────────────

def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def require_session(request: Request) -> dict[str, Any]:
    """Ensure the caller has an authenticated session; return it."""
    if not request.session.get("token"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return request.session


def credentials_from_session(session: dict[str, Any]) -> Credentials:
    """Rebuild Google credentials from the session, refreshing the access token."""
    creds = Credentials(
        token=session.get("token"),
        refresh_token=session.get("refresh_token"),
        token_uri=session.get("token_uri"),
        client_id=session.get("client_id"),
        client_secret=session.get("client_secret"),
        scopes=session.get("scopes"),
    )

    # We don't persist the expiry, so treat the token as potentially stale and
    # refresh whenever we can — this is a cheap no-op when it's still valid.
    if creds.refresh_token:
        try:
            creds.refresh(GoogleRequest())
            session["token"] = creds.token
        except Exception as exc:  # google-auth raises a variety of exception types
            logger.warning("Token refresh failed: %s", exc)
            raise HTTPException(
                status_code=401, detail="Session expired — please log in again"
            ) from exc

    return creds


# ── Google provider ───────────────────────────────────────────────────────────

class GoogleAnalyticsProvider:
    name = "google"

    def __init__(self, credentials: Credentials, client: BetaAnalyticsDataClient | None = None):
        # Use the REST transport explicitly — avoids gRPC channel issues with
        # short-lived OAuth user credentials and removes the need for grpcio.
        self._client = client or BetaAnalyticsDataClient(
            transport=BetaAnalyticsDataRestTransport(credentials=credentials)
        )

    def run_report(
        self,
        property_id: str,
        dimensions: list[str],
        metrics: list[str],
        start_date: str = "30daysAgo",
        end_date: str = "today",
        dimension_filter: tuple[str, str] | None = None,
        limit: int = 1000,
    ) -> ReportResult:
        req = RunReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name=d) for d in dimensions],
            metrics=[Metric(name=m) for m in metrics],
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            limit=limit,
        )
        if dimension_filter:
            name, value = dimension_filter
            req.dimension_filter = FilterExpression(
                filter=Filter(
                    field_name=name,
                    string_filter=Filter.StringFilter(
                        value=value, match_type=Filter.StringFilter.MatchType.EXACT
                    ),
                )
            )

        try:
            response = self._client.run_report(req)
        except GoogleAPIError as exc:
            logger.error("GA API error: %s", exc)
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        return serialize_response(response)


def serialize_response(response: Any) -> ReportResult:
    """Flatten a ``RunReportResponse`` into ``{"headers": [...], "rows": [[...]]}``."""
    headers = [h.name for h in response.dimension_headers] + [
        h.name for h in response.metric_headers
    ]
    rows = [
        [dv.value for dv in row.dimension_values] + [mv.value for mv in row.metric_values]
        for row in response.rows
    ]
    return {"headers": headers, "rows": rows}


# ── Dependency ────────────────────────────────────────────────────────────────

def get_provider(
    session: dict[str, Any] = Depends(require_session),
    settings: Settings = Depends(get_settings),
) -> ReportProvider:
    if settings.mock_mode:
        return MockAnalyticsProvider()
    return GoogleAnalyticsProvider(credentials_from_session(session))
