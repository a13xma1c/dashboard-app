"""TTL cache used to keep GA quota usage down."""

from __future__ import annotations

from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.cache import TTLCache, make_key
from app.providers import GoogleAnalyticsProvider, cache_identity


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_get_set_and_expiry() -> None:
    clock = FakeClock()
    cache: TTLCache[str] = TTLCache(ttl_seconds=60, clock=clock)
    assert cache.get("k") is None
    cache.set("k", "v")
    assert cache.get("k") == "v"
    clock.now += 59
    assert cache.get("k") == "v"
    clock.now += 2
    assert cache.get("k") is None
    assert cache.hits == 2
    assert cache.misses == 2


def test_lru_eviction() -> None:
    cache: TTLCache[int] = TTLCache(ttl_seconds=60, max_entries=2)
    cache.set("a", 1)
    cache.set("b", 2)
    assert cache.get("a") == 1  # touch a → b is now least recently used
    cache.set("c", 3)
    assert cache.get("b") is None
    assert cache.get("a") == 1
    assert cache.get("c") == 3
    assert len(cache) == 2


def test_zero_ttl_disables_cache() -> None:
    cache: TTLCache[int] = TTLCache(ttl_seconds=0)
    assert cache.enabled is False
    cache.set("a", 1)
    assert cache.get("a") is None
    assert len(cache) == 0


def test_clear() -> None:
    cache: TTLCache[int] = TTLCache(ttl_seconds=60)
    cache.set("a", 1)
    cache.clear()
    assert len(cache) == 0


def test_make_key_is_stable_and_identity_scoped() -> None:
    a = make_key("user-1", property_id="1", dimensions=["date"], limit=10)
    b = make_key("user-1", limit=10, dimensions=["date"], property_id="1")  # kwarg order irrelevant
    c = make_key("user-2", property_id="1", dimensions=["date"], limit=10)
    d = make_key("user-1", property_id="1", dimensions=["country"], limit=10)
    assert a == b
    assert a != c
    assert a != d
    assert len(a) == 64


def test_cache_identity_hashes_tokens_and_prefers_refresh_token() -> None:
    by_refresh = cache_identity({"token": "t1", "refresh_token": "r"})
    by_refresh_other_access = cache_identity({"token": "t2", "refresh_token": "r"})
    by_token = cache_identity({"token": "t1"})
    assert by_refresh == by_refresh_other_access  # access token rotation keeps the cache warm
    assert by_refresh != by_token
    assert "r" not in by_refresh and "t1" not in by_token  # never leaks the raw secret
    assert cache_identity({}) == cache_identity({"token": ""})


def _fake_response() -> MagicMock:
    response = MagicMock()
    response.dimension_headers = [MagicMock(name="h")]
    response.dimension_headers[0].name = "date"
    response.metric_headers = []
    response.rows = []
    return response


def test_google_provider_serves_repeat_queries_from_cache() -> None:
    client = MagicMock()
    client.run_report.return_value = _fake_response()
    cache: TTLCache[dict[str, object]] = TTLCache(ttl_seconds=60)
    provider = GoogleAnalyticsProvider(MagicMock(), client=client, cache=cache, cache_identity="u1")

    first = provider.run_report("1", ["date"], ["sessions"])
    second = provider.run_report("1", ["date"], ["sessions"])
    assert first == second
    assert client.run_report.call_count == 1

    provider.run_report("1", ["date"], ["sessions"], start_date="7daysAgo")  # different query
    assert client.run_report.call_count == 2


def test_cache_is_not_shared_between_users() -> None:
    client = MagicMock()
    client.run_report.return_value = _fake_response()
    cache: TTLCache[dict[str, object]] = TTLCache(ttl_seconds=60)
    GoogleAnalyticsProvider(MagicMock(), client=client, cache=cache, cache_identity="u1").run_report(
        "1", ["date"], ["sessions"]
    )
    GoogleAnalyticsProvider(MagicMock(), client=client, cache=cache, cache_identity="u2").run_report(
        "1", ["date"], ["sessions"]
    )
    assert client.run_report.call_count == 2


def test_provider_without_cache_always_calls_google() -> None:
    client = MagicMock()
    client.run_report.return_value = _fake_response()
    provider = GoogleAnalyticsProvider(MagicMock(), client=client)
    provider.run_report("1", ["date"], ["sessions"])
    provider.run_report("1", ["date"], ["sessions"])
    assert client.run_report.call_count == 2


def test_app_creates_one_cache_with_configured_ttl(real_app: FastAPI) -> None:
    from app.providers import get_report_cache

    request = MagicMock()
    request.app = real_app
    assert not hasattr(real_app.state, "report_cache")
    first = get_report_cache(request)
    second = get_report_cache(request)
    assert first is second
    assert first.ttl == real_app.state.settings.report_cache_ttl == 300


def test_real_mode_requests_share_the_cache(real_app: FastAPI) -> None:
    """Two identical requests by the same user hit Google once."""
    from unittest.mock import patch

    client = TestClient(real_app)
    login = client.get("/auth/login", follow_redirects=False)
    state = login.headers["location"].split("state=")[1].split("&")[0]
    with (
        patch("app.routers.auth.build_flow") as build_flow,
        patch("app.routers.auth.fetch_user_email", return_value=None),
    ):
        build_flow.return_value.credentials = MagicMock(
            token="t", refresh_token="r", token_uri="u", client_id="c", client_secret="s", scopes=[]
        )
        client.get(f"/auth/callback?code=x&state={state}", follow_redirects=False)

    fake_client = MagicMock()
    fake_client.run_report.return_value = _fake_response()
    with (
        patch("app.providers.BetaAnalyticsDataClient", return_value=fake_client),
        patch("app.providers.BetaAnalyticsDataRestTransport"),
        patch("app.providers.Credentials") as creds,
    ):
        creds.return_value.refresh_token = None  # skip the refresh round-trip
        assert client.get("/analytics/devices/7").status_code == 200
        assert client.get("/analytics/devices/7").status_code == 200
        assert client.get("/analytics/devices/8").status_code == 200

    assert fake_client.run_report.call_count == 2
    assert real_app.state.report_cache.hits == 1
