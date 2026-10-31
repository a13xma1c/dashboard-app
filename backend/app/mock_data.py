"""
Deterministic mock Google Analytics data.

Design goals
------------
* **Deterministic** — the same (property, dimensions, metrics, date range)
  always produces the same rows, so snapshots and tests are stable.
* **Internally consistent** — every value is derived from a per-day sessions
  figure that is split across dimension values using normalised shares.
  Summing the *device* breakdown therefore gives the same total as summing the
  *channel* breakdown or the daily time series.
* **Realistic shape** — weekly seasonality (quieter weekends), a slow trend,
  day-to-day noise and skewed popularity distributions.
* **Same wire format as the real API** — ``{"headers": [...], "rows": [[...]]}``
  with metric values as strings, exactly like ``runReport``.
"""

from __future__ import annotations

import hashlib
import random
from collections.abc import Callable, Iterator
from datetime import date
from functools import lru_cache
from typing import Any

from app.dates import DateRange, ga_date_string

ReportResult = dict[str, Any]


class UnsupportedFieldError(ValueError):
    """Raised when a dimension or metric is not supported by the mock."""


# ── Field catalogue ───────────────────────────────────────────────────────────
# (value, relative weight) pairs. Weights don't need to sum to 1.

CATEGORICAL_DIMENSIONS: dict[str, list[tuple[str, float]]] = {
    "sessionDefaultChannelGroup": [
        ("Organic Search", 42),
        ("Direct", 24),
        ("Referral", 11),
        ("Organic Social", 9),
        ("Paid Search", 6),
        ("Email", 4),
        ("Display", 2),
        ("Unassigned", 2),
    ],
    "deviceCategory": [("desktop", 55), ("mobile", 39), ("tablet", 6)],
    "country": [
        ("United States", 34),
        ("United Kingdom", 11),
        ("Germany", 8),
        ("India", 8),
        ("Canada", 6),
        ("France", 5),
        ("Australia", 4),
        ("Netherlands", 3),
        ("Brazil", 3),
        ("Spain", 3),
        ("Japan", 2.5),
        ("Italy", 2),
        ("Sweden", 1.5),
        ("Poland", 1.5),
        ("Mexico", 1.2),
        ("Switzerland", 1),
        ("Ireland", 1),
        ("Singapore", 0.9),
        ("South Korea", 0.8),
        ("Belgium", 0.7),
        ("Norway", 0.6),
        ("Denmark", 0.6),
        ("Argentina", 0.5),
        ("Austria", 0.5),
        ("New Zealand", 0.4),
        ("Portugal", 0.4),
        ("Finland", 0.3),
        ("Israel", 0.3),
        ("South Africa", 0.3),
        ("Turkey", 0.3),
    ],
    # Cities are a child of country — see CITY_COUNTRY / HIERARCHY below.
    "city": [],
    "pagePath": [
        ("/", 30),
        ("/pricing", 9),
        ("/blog", 8),
        ("/docs", 7.5),
        ("/features", 6),
        ("/blog/getting-started-with-analytics", 5),
        ("/docs/quickstart", 4.5),
        ("/about", 4),
        ("/contact", 3),
        ("/signup", 3),
        ("/login", 2.8),
        ("/blog/10-dashboard-design-tips", 2.5),
        ("/docs/api-reference", 2.5),
        ("/integrations", 2),
        ("/customers", 1.8),
        ("/blog/measuring-engagement", 1.6),
        ("/docs/authentication", 1.5),
        ("/careers", 1.2),
        ("/changelog", 1.1),
        ("/docs/webhooks", 1),
        ("/blog/year-in-review", 0.9),
        ("/security", 0.8),
        ("/privacy", 0.7),
        ("/terms", 0.5),
        ("/status", 0.4),
    ],
    "landingPage": [
        ("/", 42),
        ("/blog/getting-started-with-analytics", 9),
        ("/pricing", 8),
        ("/docs", 7),
        ("/blog", 6),
        ("/features", 5),
        ("/docs/quickstart", 4.5),
        ("/blog/10-dashboard-design-tips", 4),
        ("/signup", 3),
        ("/about", 2.5),
        ("/integrations", 2),
        ("/blog/measuring-engagement", 1.8),
        ("/docs/api-reference", 1.5),
        ("/customers", 1.2),
        ("/careers", 1),
        ("/changelog", 0.8),
    ],
    "browser": [
        ("Chrome", 58),
        ("Safari", 22),
        ("Firefox", 7),
        ("Edge", 7),
        ("Samsung Internet", 3),
        ("Opera", 1.5),
        ("Android Webview", 1),
        ("Safari (in-app)", 0.5),
    ],
    "operatingSystem": [
        ("Windows", 38),
        ("iOS", 22),
        ("Android", 18),
        ("Macintosh", 16),
        ("Linux", 4),
        ("Chrome OS", 2),
    ],
    "sessionSource": [
        ("google", 46),
        ("(direct)", 24),
        ("bing", 5),
        ("facebook.com", 4),
        ("t.co", 3),
        ("linkedin.com", 3),
        ("newsletter", 3),
        ("duckduckgo", 2.5),
        ("github.com", 2.5),
        ("reddit.com", 2),
        ("youtube.com", 1.5),
        ("yahoo", 1.5),
        ("producthunt.com", 1),
        ("news.ycombinator.com", 1),
    ],
    "sessionMedium": [
        ("organic", 50),
        ("(none)", 24),
        ("referral", 12),
        ("cpc", 6),
        ("email", 4),
        ("social", 4),
    ],
    "newVsReturning": [("new", 58), ("returning", 40), ("(not set)", 2)],
    "eventName": [
        ("page_view", 40),
        ("session_start", 15),
        ("user_engagement", 14),
        ("scroll", 12),
        ("first_visit", 8),
        ("click", 6),
        ("view_search_results", 2),
        ("form_submit", 1.5),
        ("sign_up", 0.9),
        ("file_download", 0.4),
        ("purchase", 0.2),
    ],
    "language": [
        ("en-us", 50),
        ("en-gb", 14),
        ("de-de", 8),
        ("fr-fr", 5),
        ("es-es", 4),
        ("pt-br", 3),
        ("en-in", 3),
        ("nl-nl", 3),
        ("ja-jp", 2),
        ("it-it", 2),
        ("sv-se", 1.5),
        ("pl-pl", 1.5),
        ("en-ca", 1.5),
        ("en-au", 1.5),
    ],
    # Diurnal curve — quiet overnight, peaks late morning and mid-afternoon.
    "hour": [
        (f"{h:02d}", w)
        for h, w in enumerate(
            [
                1.2,
                0.9,
                0.7,
                0.6,
                0.6,
                0.8,
                1.4,
                2.4,
                3.8,
                5.2,
                6.0,
                6.2,
                5.8,
                6.1,
                6.3,
                6.0,
                5.4,
                4.6,
                3.9,
                3.6,
                3.4,
                3.0,
                2.4,
                1.7,
            ]
        )
    ],
}

# ── Hierarchical dimensions ───────────────────────────────────────────────────
# A city belongs to exactly one country, so filtering by country narrows the
# city list (and city totals add up to their country's total).

CITY_COUNTRY: list[tuple[str, str, float]] = [
    # (city, country, weight within the country)
    ("New York", "United States", 9),
    ("San Francisco", "United States", 5),
    ("Los Angeles", "United States", 4),
    ("Chicago", "United States", 3),
    ("Seattle", "United States", 2.5),
    ("Austin", "United States", 2),
    ("Boston", "United States", 2),
    ("Denver", "United States", 1),
    ("(not set)", "United States", 4),
    ("London", "United Kingdom", 8),
    ("Manchester", "United Kingdom", 2),
    ("Edinburgh", "United Kingdom", 1),
    ("Berlin", "Germany", 4),
    ("Munich", "Germany", 1.8),
    ("Hamburg", "Germany", 1.2),
    ("Bengaluru", "India", 3),
    ("Mumbai", "India", 2),
    ("Delhi", "India", 1.8),
    ("Hyderabad", "India", 1.2),
    ("Toronto", "Canada", 3.5),
    ("Vancouver", "Canada", 1.1),
    ("Montreal", "Canada", 1),
    ("Paris", "France", 3),
    ("Lyon", "France", 0.8),
    ("Sydney", "Australia", 2.5),
    ("Melbourne", "Australia", 1.2),
    ("Amsterdam", "Netherlands", 2.5),
    ("Rotterdam", "Netherlands", 0.6),
    ("São Paulo", "Brazil", 1.8),
    ("Rio de Janeiro", "Brazil", 0.9),
    ("Madrid", "Spain", 1.6),
    ("Barcelona", "Spain", 1.3),
    ("Tokyo", "Japan", 1.5),
    ("Osaka", "Japan", 0.5),
    ("Milan", "Italy", 1),
    ("Rome", "Italy", 0.9),
    ("Stockholm", "Sweden", 1.2),
    ("Warsaw", "Poland", 1.2),
    ("Mexico City", "Mexico", 1),
    ("Zurich", "Switzerland", 0.8),
    ("Dublin", "Ireland", 1.4),
    ("Singapore", "Singapore", 0.9),
    ("Seoul", "South Korea", 0.8),
    ("Brussels", "Belgium", 0.6),
    ("Oslo", "Norway", 0.6),
    ("Copenhagen", "Denmark", 0.6),
    ("Buenos Aires", "Argentina", 0.5),
    ("Vienna", "Austria", 0.5),
    ("Auckland", "New Zealand", 0.4),
    ("Lisbon", "Portugal", 0.4),
    ("Helsinki", "Finland", 0.3),
    ("Tel Aviv", "Israel", 0.3),
    ("Cape Town", "South Africa", 0.3),
    ("Istanbul", "Turkey", 0.3),
]

# child dimension -> parent dimension
HIERARCHY: dict[str, str] = {"city": "country"}

# child dimension -> {child value: parent value}
PARENT_OF: dict[str, dict[str, str]] = {
    "city": {city: country for city, country, _ in CITY_COUNTRY},
}

# child dimension -> {parent value: [(child value, weight), ...]}
CHILDREN_OF: dict[str, dict[str, list[tuple[str, float]]]] = {"city": {}}
for _city, _country, _w in CITY_COUNTRY:
    CHILDREN_OF["city"].setdefault(_country, []).append((_city, _w))

CATEGORICAL_DIMENSIONS["city"] = [(c, w) for c, _, w in CITY_COUNTRY]

# Dimensions whose value is a pure function of the calendar day.
DERIVED_DIMENSIONS: dict[str, Callable[[date], str]] = {
    "date": ga_date_string,
    # GA: 0 = Sunday … 6 = Saturday. Python: Monday = 0.
    "dayOfWeek": lambda d: str((d.weekday() + 1) % 7),
    "month": lambda d: d.strftime("%m"),
    "year": lambda d: d.strftime("%Y"),
    "yearMonth": lambda d: d.strftime("%Y%m"),
}

# Metrics that are simple sums over days / rows.
ADDITIVE_METRICS = (
    "sessions",
    "totalUsers",
    "activeUsers",
    "newUsers",
    "screenPageViews",
    "engagedSessions",
    "eventCount",
    "conversions",
    "keyEvents",
    "userEngagementDuration",
)


def _safe_div(a: float, b: float) -> float:
    return a / b if b else 0.0


# Metrics computed from additive totals after aggregation.
DERIVED_METRICS: dict[str, Callable[[dict[str, float]], float]] = {
    "averageSessionDuration": lambda t: _safe_div(t["userEngagementDuration"], t["sessions"]),
    "engagementRate": lambda t: _safe_div(t["engagedSessions"], t["sessions"]),
    "bounceRate": lambda t: 1 - _safe_div(t["engagedSessions"], t["sessions"]),
    "screenPageViewsPerSession": lambda t: _safe_div(t["screenPageViews"], t["sessions"]),
    "eventsPerSession": lambda t: _safe_div(t["eventCount"], t["sessions"]),
    "sessionsPerUser": lambda t: _safe_div(t["sessions"], t["totalUsers"]),
}

# Human-friendly metadata consumed by the frontend's report builder.
DIMENSION_LABELS: dict[str, str] = {
    "date": "Date",
    "dayOfWeek": "Day of week",
    "month": "Month",
    "year": "Year",
    "yearMonth": "Year / month",
    "hour": "Hour of day",
    "sessionDefaultChannelGroup": "Channel group",
    "sessionSource": "Session source",
    "sessionMedium": "Session medium",
    "deviceCategory": "Device category",
    "browser": "Browser",
    "operatingSystem": "Operating system",
    "country": "Country",
    "city": "City",
    "language": "Language",
    "pagePath": "Page path",
    "landingPage": "Landing page",
    "newVsReturning": "New vs returning",
    "eventName": "Event name",
}

METRIC_INFO: dict[str, dict[str, str]] = {
    "sessions": {"label": "Sessions", "type": "integer"},
    "totalUsers": {"label": "Total users", "type": "integer"},
    "activeUsers": {"label": "Active users", "type": "integer"},
    "newUsers": {"label": "New users", "type": "integer"},
    "screenPageViews": {"label": "Views", "type": "integer"},
    "engagedSessions": {"label": "Engaged sessions", "type": "integer"},
    "eventCount": {"label": "Event count", "type": "integer"},
    "conversions": {"label": "Conversions", "type": "integer"},
    "keyEvents": {"label": "Key events", "type": "integer"},
    "userEngagementDuration": {"label": "User engagement duration", "type": "seconds"},
    "averageSessionDuration": {"label": "Avg. session duration", "type": "seconds"},
    "engagementRate": {"label": "Engagement rate", "type": "percent"},
    "bounceRate": {"label": "Bounce rate", "type": "percent"},
    "screenPageViewsPerSession": {"label": "Views per session", "type": "float"},
    "eventsPerSession": {"label": "Events per session", "type": "float"},
    "sessionsPerUser": {"label": "Sessions per user", "type": "float"},
}

SUPPORTED_DIMENSIONS = frozenset(CATEGORICAL_DIMENSIONS) | frozenset(DERIVED_DIMENSIONS)
SUPPORTED_METRICS = frozenset(ADDITIVE_METRICS) | frozenset(DERIVED_METRICS)

# Reference day for the long-term trend so results don't drift as time passes.
_TREND_ORIGIN = date(2024, 1, 1)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _rng(*parts: object) -> random.Random:
    """A ``random.Random`` seeded stably from the given parts (hash() is salted per process)."""
    key = "|".join(str(p) for p in parts).encode()
    seed = int.from_bytes(hashlib.sha256(key).digest()[:8], "big")
    return random.Random(seed)


@lru_cache(maxsize=4096)
def _property_profile(property_id: str) -> dict[str, float]:
    r = _rng("profile", property_id)
    return {
        "base_sessions": r.uniform(600, 4000),
        "weekend_factor": r.uniform(0.6, 0.8),
        "yearly_growth": r.uniform(-0.15, 0.35),  # relative change per 365 days
        "users_ratio": r.uniform(0.72, 0.9),
        "new_ratio": r.uniform(0.45, 0.72),
        "views_per_session": r.uniform(1.7, 3.2),
        "engagement": r.uniform(0.48, 0.72),
        "avg_duration": r.uniform(55, 240),
        "events_per_view": r.uniform(2.0, 3.8),
        "conversion": r.uniform(0.01, 0.045),
    }


@lru_cache(maxsize=65536)
def _daily_sessions(property_id: str, day: date) -> float:
    p = _property_profile(property_id)
    r = _rng("daily", property_id, day.isoformat())

    weekly = p["weekend_factor"] if day.weekday() >= 5 else 1.0
    days_from_origin = (day - _TREND_ORIGIN).days
    trend = 1 + p["yearly_growth"] * days_from_origin / 365
    noise = r.uniform(0.85, 1.15)
    spike = r.uniform(1.6, 2.6) if r.random() < 0.03 else 1.0

    return max(p["base_sessions"] * weekly * max(trend, 0.2) * noise * spike, 1.0)


def _normalised(
    property_id: str, dimension: str, day: date, values: list[tuple[str, float]], salt: str = ""
) -> dict[str, float]:
    prop_r = _rng("share", property_id, dimension, salt)
    day_r = _rng("share", property_id, dimension, salt, day.isoformat())
    weighted: dict[str, float] = {}
    for value, weight in values:
        # Property-specific bias (stable) × daily wobble.
        weighted[value] = weight * prop_r.uniform(0.7, 1.3) * day_r.uniform(0.9, 1.1)
    total = sum(weighted.values())
    return {v: w / total for v, w in weighted.items()}


@lru_cache(maxsize=65536)
def _shares(property_id: str, dimension: str, day: date) -> dict[str, float]:
    """
    Normalised share of each value of ``dimension`` on ``day``.

    For hierarchical dimensions (city → country) the share is
    ``share(parent) × share(child within parent)`` so children add up exactly
    to their parent.
    """
    if dimension in HIERARCHY:
        parent_shares = _shares(property_id, HIERARCHY[dimension], day)
        result: dict[str, float] = {}
        for parent_value in CHILDREN_OF[dimension]:
            within = _conditional_shares(property_id, dimension, day, parent_value)
            for child, share in within.items():
                result[child] = parent_shares.get(parent_value, 0.0) * share
        return result
    return _normalised(property_id, dimension, day, CATEGORICAL_DIMENSIONS[dimension])


@lru_cache(maxsize=65536)
def _conditional_shares(property_id: str, dimension: str, day: date, parent_value: str) -> dict[str, float]:
    """Share of each child value *within* ``parent_value`` (sums to 1)."""
    children = CHILDREN_OF[dimension].get(parent_value, [])
    if not children:
        return {}
    return _normalised(property_id, dimension, day, children, salt=parent_value)


def _format_metric(name: str, value: float) -> str:
    if name in ADDITIVE_METRICS:
        return str(round(value))
    # Derived metrics are floats; GA returns them with plenty of precision.
    return f"{value:.6f}".rstrip("0").rstrip(".") if value else "0"


# ── Provider ──────────────────────────────────────────────────────────────────


class MockAnalyticsProvider:
    """Drop-in stand-in for the GA Data API used when ``GA_MOCK_MODE`` is on."""

    name = "mock"

    def __init__(self, today: date | None = None) -> None:
        self._today = today

    # The signature matches GoogleAnalyticsProvider.run_report.
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
        self._validate(dimensions, metrics, dimension_filter)
        date_range = DateRange.parse(start_date, end_date, self._today)

        categorical = [d for d in dimensions if d in CATEGORICAL_DIMENSIONS]
        filter_dim, filter_value = dimension_filter or (None, None)

        # Accumulate additive totals keyed by the tuple of dimension values.
        totals: dict[tuple[str, ...], dict[str, float]] = {}
        for day in date_range.iter_days():
            day_sessions = _daily_sessions(property_id, day)

            if filter_dim in CATEGORICAL_DIMENSIONS and filter_value is not None:
                share = _shares(property_id, filter_dim, day).get(filter_value, 0.0)
                if share == 0.0:
                    continue
                day_sessions *= share
            elif filter_dim in DERIVED_DIMENSIONS:
                if DERIVED_DIMENSIONS[filter_dim](day) != filter_value:
                    continue

            for combo in self._combos(categorical, filter_dim, filter_value):
                chosen = dict(zip(categorical, combo, strict=True))
                sessions = day_sessions
                for dim, value in chosen.items():
                    sessions *= self._share_for(
                        property_id, dim, value, day, chosen, filter_dim, filter_value
                    )

                key = tuple(
                    DERIVED_DIMENSIONS[d](day) if d in DERIVED_DIMENSIONS else combo[categorical.index(d)]
                    for d in dimensions
                )
                row_totals = totals.setdefault(key, {m: 0.0 for m in ADDITIVE_METRICS})
                for m, v in self._additive_for(property_id, key, day, sessions).items():
                    row_totals[m] += v

        rows = [
            list(key) + [_format_metric(m, self._metric_value(m, t)) for m in metrics]
            for key, t in totals.items()
            if t["sessions"] >= 0.5  # drop rows that round to zero sessions
        ]

        # Chronological when the first dimension is time-based, else by the first metric desc.
        if dimensions and dimensions[0] in DERIVED_DIMENSIONS:
            rows.sort(key=lambda r: r[0])
        elif metrics:
            rows.sort(key=lambda r: float(r[len(dimensions)]), reverse=True)

        return {"headers": [*dimensions, *metrics], "rows": rows[:limit]}

    # ── internals ─────────────────────────────────────────────────────────────

    @staticmethod
    def _validate(
        dimensions: list[str], metrics: list[str], dimension_filter: tuple[str, str] | None
    ) -> None:
        unknown_dims = [d for d in dimensions if d not in SUPPORTED_DIMENSIONS]
        if unknown_dims:
            raise UnsupportedFieldError(f"Unsupported dimension(s): {', '.join(unknown_dims)}")
        unknown_metrics = [m for m in metrics if m not in SUPPORTED_METRICS]
        if unknown_metrics:
            raise UnsupportedFieldError(f"Unsupported metric(s): {', '.join(unknown_metrics)}")
        if not metrics:
            raise UnsupportedFieldError("At least one metric is required")
        if dimension_filter and dimension_filter[0] not in SUPPORTED_DIMENSIONS:
            raise UnsupportedFieldError(f"Unsupported filter dimension: {dimension_filter[0]}")

    @staticmethod
    def _values_for(dim: str, filter_dim: str | None, filter_value: str | None) -> list[str]:
        """Values of ``dim`` compatible with the active filter (hierarchy-aware)."""
        values = [v for v, _ in CATEGORICAL_DIMENSIONS[dim]]
        if filter_dim is None or filter_value is None:
            return values
        # Filter on the parent (country=X) → only children of X.
        if HIERARCHY.get(dim) == filter_dim:
            return [v for v in values if PARENT_OF[dim].get(v) == filter_value]
        # Filter on the child (city=Y) → only Y's parent.
        if HIERARCHY.get(filter_dim) == dim:
            parent = PARENT_OF[filter_dim].get(filter_value)
            return [parent] if parent in values else []
        # Same dimension as the filter → only the filtered value.
        if dim == filter_dim:
            return [filter_value] if filter_value in values else []
        return values

    @classmethod
    def _combos(
        cls,
        categorical: list[str],
        filter_dim: str | None = None,
        filter_value: str | None = None,
    ) -> Iterator[tuple[str, ...]]:
        """
        Cartesian product of the (filter-compatible) values of all categorical
        dimensions, skipping combinations that violate the hierarchy
        (e.g. country=Germany with city=London).
        """
        combos: list[tuple[str, ...]] = [()]
        for dim in categorical:
            values = cls._values_for(dim, filter_dim, filter_value)
            combos = [(*c, v) for c in combos for v in values]

        for combo in combos:
            chosen = dict(zip(categorical, combo, strict=True))
            if all(
                PARENT_OF[child].get(value) == chosen[parent]
                for child, parent in HIERARCHY.items()
                if child in chosen and parent in chosen
                for value in [chosen[child]]
            ):
                yield combo

    @staticmethod
    def _share_for(
        property_id: str,
        dim: str,
        value: str,
        day: date,
        chosen: dict[str, str],
        filter_dim: str | None,
        filter_value: str | None,
    ) -> float:
        """
        Share to multiply into the day's (already filtered) sessions for ``value``.

        * filter == dim, or filter is a child of dim → the value is fully
          determined by the filter and contributes everything (1.0).
        * dim's parent is fixed (by the filter or by another requested
          dimension) → only the *within-parent* share applies, because the
          parent's share has already been accounted for.
        * otherwise → the plain (hierarchy-inclusive) share.
        """
        if (
            filter_dim is not None
            and filter_value is not None
            and (dim == filter_dim or HIERARCHY.get(filter_dim) == dim)
        ):
            return 1.0
        parent = HIERARCHY.get(dim)
        if parent is not None:
            parent_value = chosen.get(parent)
            if parent_value is None and filter_dim == parent:
                parent_value = filter_value
            if parent_value is not None:
                return _conditional_shares(property_id, dim, day, parent_value).get(value, 0.0)
        return _shares(property_id, dim, day).get(value, 0.0)

    @staticmethod
    def _additive_for(property_id: str, key: tuple[str, ...], day: date, sessions: float) -> dict[str, float]:
        p = _property_profile(property_id)
        r = _rng("row", property_id, key, day.isoformat())

        def jitter() -> float:
            return r.uniform(0.9, 1.1)

        users = sessions * p["users_ratio"] * jitter()
        new_users = users * p["new_ratio"] * jitter()
        views = sessions * p["views_per_session"] * jitter()
        engaged = sessions * min(p["engagement"] * jitter(), 0.98)
        duration = sessions * p["avg_duration"] * jitter()
        events = views * p["events_per_view"] * jitter()
        conversions = sessions * p["conversion"] * jitter()

        return {
            "sessions": sessions,
            "totalUsers": users,
            "activeUsers": users,
            "newUsers": new_users,
            "screenPageViews": views,
            "engagedSessions": engaged,
            "eventCount": events,
            "conversions": conversions,
            "keyEvents": conversions,
            "userEngagementDuration": duration,
        }

    @staticmethod
    def _metric_value(metric: str, totals: dict[str, float]) -> float:
        if metric in DERIVED_METRICS:
            return DERIVED_METRICS[metric](totals)
        return totals[metric]


def metadata() -> dict[str, list[dict[str, str]]]:
    """Catalogue of supported fields, for the frontend report builder."""
    return {
        "dimensions": [
            {"name": name, "label": DIMENSION_LABELS.get(name, name)} for name in DIMENSION_LABELS
        ],
        "metrics": [{"name": name, **info} for name, info in METRIC_INFO.items()],
    }
