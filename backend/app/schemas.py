"""Pydantic response models — documents the API shape in OpenAPI and validates output."""

from __future__ import annotations

from pydantic import BaseModel


class ReportResponse(BaseModel):
    """Flattened GA ``runReport`` result. Metric values are strings, as GA returns them."""

    headers: list[str]
    rows: list[list[str]]


class DateRangeOut(BaseModel):
    start_date: str
    end_date: str


class SummaryResponse(BaseModel):
    metrics: list[str]
    current: dict[str, float]
    previous: dict[str, float]
    current_range: DateRangeOut
    previous_range: DateRangeOut


class AuthStatus(BaseModel):
    authenticated: bool
    mock_mode: bool
    email: str | None = None
