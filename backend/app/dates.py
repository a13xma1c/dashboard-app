"""
Date helpers that mirror the GA Data API's relative date syntax.

GA accepts ``today``, ``yesterday``, ``NdaysAgo`` and ``YYYY-MM-DD``.  The mock
provider needs concrete dates to enumerate rows, and the summary endpoint needs
to compute the "previous period" for period-over-period comparisons.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, timedelta

_DAYS_AGO = re.compile(r"^(\d+)daysAgo$")
_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class InvalidDateError(ValueError):
    """Raised when a date string is not in a GA-compatible format."""


def resolve_date(value: str, today: date | None = None) -> date:
    """Resolve a GA-style date string to a concrete ``date``."""
    today = today or date.today()
    value = value.strip()

    if value == "today":
        return today
    if value == "yesterday":
        return today - timedelta(days=1)

    m = _DAYS_AGO.match(value)
    if m:
        return today - timedelta(days=int(m.group(1)))

    if _ISO.match(value):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise InvalidDateError(f"Invalid date: {value!r}") from exc

    raise InvalidDateError(f"Invalid date {value!r}. Use YYYY-MM-DD, 'today', 'yesterday' or 'NdaysAgo'.")


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date

    def __post_init__(self) -> None:
        if self.start > self.end:
            raise InvalidDateError(f"start_date ({self.start}) must not be after end_date ({self.end})")

    @classmethod
    def parse(cls, start: str, end: str, today: date | None = None) -> DateRange:
        return cls(resolve_date(start, today), resolve_date(end, today))

    @property
    def days(self) -> int:
        """Number of days in the range, inclusive of both ends."""
        return (self.end - self.start).days + 1

    def iter_days(self) -> Iterator[date]:
        for i in range(self.days):
            yield self.start + timedelta(days=i)

    def previous(self) -> DateRange:
        """The range of equal length immediately preceding this one."""
        end = self.start - timedelta(days=1)
        start = end - timedelta(days=self.days - 1)
        return DateRange(start, end)

    def to_dict(self) -> dict[str, str]:
        return {"start_date": self.start.isoformat(), "end_date": self.end.isoformat()}


def ga_date_string(d: date) -> str:
    """GA reports the ``date`` dimension as ``YYYYMMDD``."""
    return d.strftime("%Y%m%d")
