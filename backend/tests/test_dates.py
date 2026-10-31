from datetime import date

import pytest

from app.dates import DateRange, InvalidDateError, ga_date_string, resolve_date

TODAY = date(2025, 3, 15)


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("today", date(2025, 3, 15)),
        ("yesterday", date(2025, 3, 14)),
        ("0daysAgo", date(2025, 3, 15)),
        ("7daysAgo", date(2025, 3, 8)),
        ("30daysAgo", date(2025, 2, 13)),
        ("365daysAgo", date(2024, 3, 15)),
        ("2025-01-31", date(2025, 1, 31)),
        ("  today  ", date(2025, 3, 15)),
    ],
)
def test_resolve_date(raw: str, expected: date) -> None:
    assert resolve_date(raw, TODAY) == expected


@pytest.mark.parametrize("raw", ["", "tomorrow", "7days", "daysAgo", "2025/01/01", "2025-13-45", "20250101"])
def test_resolve_date_rejects_garbage(raw: str) -> None:
    with pytest.raises(InvalidDateError):
        resolve_date(raw, TODAY)


def test_resolve_date_defaults_to_real_today() -> None:
    assert resolve_date("today") == date.today()


def test_date_range_parse_and_days() -> None:
    r = DateRange.parse("7daysAgo", "today", TODAY)
    assert r.start == date(2025, 3, 8)
    assert r.end == TODAY
    assert r.days == 8
    assert next(iter(r.iter_days())) == r.start
    assert list(r.iter_days())[-1] == r.end
    assert len(list(r.iter_days())) == 8


def test_date_range_rejects_inverted_range() -> None:
    with pytest.raises(InvalidDateError, match="must not be after"):
        DateRange.parse("today", "yesterday", TODAY)


def test_single_day_range() -> None:
    r = DateRange.parse("today", "today", TODAY)
    assert r.days == 1


def test_previous_period_is_adjacent_and_same_length() -> None:
    r = DateRange(date(2025, 3, 1), date(2025, 3, 15))
    prev = r.previous()
    assert prev.end == date(2025, 2, 28)
    assert prev.days == r.days == 15
    assert prev.start == date(2025, 2, 14)


def test_to_dict() -> None:
    r = DateRange(date(2025, 3, 1), date(2025, 3, 15))
    assert r.to_dict() == {"start_date": "2025-03-01", "end_date": "2025-03-15"}


def test_ga_date_string() -> None:
    assert ga_date_string(date(2025, 3, 5)) == "20250305"
