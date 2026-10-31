"""Report cache: memory + Redis backends, caching wrapper, factory, and wiring."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock, patch

import fakeredis
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError

from app.cache import (
    MemoryCache,
    RedisCache,
    ReportCache,
    TTLCache,
    _redacted,
    build_cache,
    make_key,
)
from app.config import Settings
from app.factory import create_app
from app.mock_data import MockAnalyticsProvider
from app.providers import CachedReportProvider, GoogleAnalyticsProvider, cache_identity

REPORT: dict[str, Any] = {"headers": ["date", "sessions"], "rows": [["20250301", "10"]]}


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


# ── MemoryCache ───────────────────────────────────────────────────────────────


def test_memory_get_set_and_expiry() -> None:
    clock = FakeClock()
    cache = MemoryCache(ttl_seconds=60, clock=clock)
    assert cache.get("k") is None
    cache.set("k", REPORT)
    assert cache.get("k") == REPORT
    clock.now += 59
    assert cache.get("k") == REPORT
    clock.now += 2
    assert cache.get("k") is None
    assert cache.stats() == {
        "backend": "memory",
        "enabled": True,
        "ttl_seconds": 60,
        "entries": 0,
        "hits": 2,
        "misses": 2,
    }


def test_memory_lru_eviction() -> None:
    cache = MemoryCache(ttl_seconds=60, max_entries=2)
    cache.set("a", {"v": 1})
    cache.set("b", {"v": 2})
    assert cache.get("a") == {"v": 1}  # touch a → b is now least recently used
    cache.set("c", {"v": 3})
    assert cache.get("b") is None
    assert cache.get("a") == {"v": 1}
    assert cache.get("c") == {"v": 3}
    assert len(cache) == 2


def test_memory_zero_ttl_disables_cache() -> None:
    cache = MemoryCache(ttl_seconds=0)
    assert cache.enabled is False
    cache.set("a", REPORT)
    assert cache.get("a") is None
    assert len(cache) == 0


def test_memory_clear_and_ping() -> None:
    cache = MemoryCache(ttl_seconds=60)
    cache.set("a", REPORT)
    cache.clear()
    assert len(cache) == 0
    assert cache.ping() is True


def test_ttlcache_alias_is_memory_cache() -> None:
    assert TTLCache is MemoryCache


# ── RedisCache ────────────────────────────────────────────────────────────────


@pytest.fixture
def fake_redis() -> fakeredis.FakeRedis:
    return fakeredis.FakeRedis(decode_responses=True)


def test_redis_get_set_with_ttl(fake_redis: fakeredis.FakeRedis) -> None:
    cache = RedisCache(fake_redis, ttl_seconds=120)
    assert cache.get("k") is None
    cache.set("k", REPORT)
    assert cache.get("k") == REPORT
    # Stored under the namespace as compact JSON with a TTL managed by Redis.
    assert fake_redis.get("ga:report:k") == json.dumps(REPORT, separators=(",", ":"))
    assert 0 < fake_redis.ttl("ga:report:k") <= 120
    assert cache.stats() == {
        "backend": "redis",
        "enabled": True,
        "ttl_seconds": 120,
        "hits": 1,
        "misses": 1,
        "errors": 0,
    }


def test_redis_entries_expire(fake_redis: fakeredis.FakeRedis) -> None:
    cache = RedisCache(fake_redis, ttl_seconds=1)
    cache.set("k", REPORT)
    # fakeredis honours TTLs; fast-forward by expiring the key explicitly.
    fake_redis.expire("ga:report:k", 0)
    assert cache.get("k") is None


def test_redis_zero_ttl_disables(fake_redis: fakeredis.FakeRedis) -> None:
    cache = RedisCache(fake_redis, ttl_seconds=0)
    assert cache.enabled is False
    cache.set("k", REPORT)
    assert fake_redis.keys("*") == []
    assert cache.get("k") is None


def test_redis_clear_only_touches_namespace(fake_redis: fakeredis.FakeRedis) -> None:
    cache = RedisCache(fake_redis, ttl_seconds=60)
    for i in range(1200):  # exercises the batched SCAN/DELETE path
        cache.set(f"k{i}", REPORT)
    fake_redis.set("unrelated", "keep me")
    cache.clear()
    assert fake_redis.keys("ga:report:*") == []
    assert fake_redis.get("unrelated") == "keep me"


def test_redis_discards_corrupt_entries(fake_redis: fakeredis.FakeRedis) -> None:
    cache = RedisCache(fake_redis, ttl_seconds=60)
    fake_redis.set("ga:report:bad", "{not json")
    assert cache.get("bad") is None
    assert cache.misses == 1


def test_redis_is_fail_soft_when_unreachable() -> None:
    broken = MagicMock()
    broken.get.side_effect = RedisConnectionError("down")
    broken.set.side_effect = RedisConnectionError("down")
    broken.ping.side_effect = RedisConnectionError("down")
    broken.scan_iter.side_effect = RedisConnectionError("down")
    cache = RedisCache(broken, ttl_seconds=60)

    assert cache.get("k") is None  # miss, not an exception
    cache.set("k", REPORT)  # swallowed
    cache.clear()  # swallowed
    assert cache.ping() is False
    assert cache.errors == 3


def test_redis_from_url_configures_client() -> None:
    with patch("app.cache.redis.Redis.from_url") as from_url:
        cache = RedisCache.from_url("redis://cache:6379/1", ttl_seconds=30, prefix="x:")
    from_url.assert_called_once_with(
        "redis://cache:6379/1", decode_responses=True, socket_connect_timeout=2.0, socket_timeout=2.0
    )
    assert cache.ttl == 30
    assert cache.prefix == "x:"


# ── Factory ───────────────────────────────────────────────────────────────────


def test_build_cache_defaults_to_memory() -> None:
    cache = build_cache(300)
    assert isinstance(cache, MemoryCache)
    assert cache.ttl == 300


def test_build_cache_uses_redis_when_reachable() -> None:
    server = fakeredis.FakeServer()
    with patch(
        "app.cache.redis.Redis.from_url",
        return_value=fakeredis.FakeRedis(server=server, decode_responses=True),
    ):
        cache = build_cache(300, "redis://localhost:6379/0")
    assert isinstance(cache, RedisCache)
    assert cache.ping() is True


def test_build_cache_falls_back_to_memory_when_redis_is_down(caplog: pytest.LogCaptureFixture) -> None:
    server = fakeredis.FakeServer()
    server.connected = False
    with patch(
        "app.cache.redis.Redis.from_url",
        return_value=fakeredis.FakeRedis(server=server, decode_responses=True),
    ):
        cache = build_cache(300, "redis://:secret@localhost:6379/0")
    assert isinstance(cache, MemoryCache)
    assert "falling back to in-memory cache" in caplog.text
    assert "secret" not in caplog.text


def test_redacted_hides_credentials() -> None:
    assert _redacted("redis://user:pw@host:6379/0") == "redis://***@host:6379/0"
    assert _redacted("redis://host:6379/0") == "redis://host:6379/0"
    assert _redacted("not-a-url") == "not-a-url"


# ── Keys & identity ───────────────────────────────────────────────────────────


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


# ── CachedReportProvider ──────────────────────────────────────────────────────


def _fake_response() -> MagicMock:
    response = MagicMock()
    header = MagicMock()
    header.name = "date"
    response.dimension_headers = [header]
    response.metric_headers = []
    response.rows = []
    return response


def test_wrapper_serves_repeat_queries_from_cache() -> None:
    inner = MagicMock()
    inner.name = "google"
    inner.run_report.return_value = REPORT
    cache = MemoryCache(ttl_seconds=60)
    provider = CachedReportProvider(inner, cache, identity="u1")

    assert provider.run_report("1", ["date"], ["sessions"]) == REPORT
    assert provider.run_report("1", ["date"], ["sessions"]) == REPORT
    assert inner.run_report.call_count == 1
    assert provider.name == "google"

    provider.run_report("1", ["date"], ["sessions"], start_date="7daysAgo")  # different query
    assert inner.run_report.call_count == 2
    inner.run_report.assert_called_with(
        "1",
        dimensions=["date"],
        metrics=["sessions"],
        start_date="7daysAgo",
        end_date="today",
        dimension_filter=None,
        limit=1000,
    )


def test_wrapper_keeps_users_apart() -> None:
    inner = MagicMock()
    inner.name = "google"
    inner.run_report.return_value = REPORT
    cache = MemoryCache(ttl_seconds=60)
    CachedReportProvider(inner, cache, "u1").run_report("1", ["date"], ["sessions"])
    CachedReportProvider(inner, cache, "u2").run_report("1", ["date"], ["sessions"])
    assert inner.run_report.call_count == 2


def test_wrapper_works_with_redis_and_mock_provider(fake_redis: fakeredis.FakeRedis) -> None:
    cache = RedisCache(fake_redis, ttl_seconds=60)
    provider = CachedReportProvider(MockAnalyticsProvider(), cache, identity="mock")
    first = provider.run_report("123", ["deviceCategory"], ["sessions"])
    second = provider.run_report("123", ["deviceCategory"], ["sessions"])
    assert first == second
    assert cache.hits == 1 and cache.misses == 1
    assert len(fake_redis.keys("ga:report:*")) == 1


def test_google_provider_itself_never_caches() -> None:
    client = MagicMock()
    client.run_report.return_value = _fake_response()
    provider = GoogleAnalyticsProvider(MagicMock(), client=client)
    provider.run_report("1", ["date"], ["sessions"])
    provider.run_report("1", ["date"], ["sessions"])
    assert client.run_report.call_count == 2


# ── App wiring ────────────────────────────────────────────────────────────────


def test_app_builds_cache_from_settings() -> None:
    app = create_app(Settings(session_secret="s", mock_mode=True, report_cache_ttl=42))
    cache: ReportCache = app.state.report_cache
    assert isinstance(cache, MemoryCache)
    assert cache.ttl == 42


def test_app_accepts_injected_cache_and_reports_it_in_health(fake_redis: fakeredis.FakeRedis) -> None:
    cache = RedisCache(fake_redis, ttl_seconds=60)
    app = create_app(Settings(session_secret="s", mock_mode=True), cache=cache)
    client = TestClient(app)
    health = client.get("/health").json()
    assert health["cache"] == {
        "backend": "redis",
        "enabled": True,
        "ttl_seconds": 60,
        "hits": 0,
        "misses": 0,
        "errors": 0,
        "reachable": True,
    }

    client.get("/auth/login", follow_redirects=False)
    client.get("/analytics/devices/1")
    client.get("/analytics/devices/1")
    health = client.get("/health").json()
    assert health["cache"]["hits"] == 1
    assert health["cache"]["misses"] == 1


def test_disabled_cache_bypasses_wrapper(real_app: FastAPI) -> None:
    from app.providers import get_provider, get_report_cache, get_settings, require_session

    app = create_app(Settings(session_secret="s", mock_mode=True, report_cache_ttl=0))
    provider = get_provider(
        session={"token": "t"},
        settings=get_settings(MagicMock(app=app)),
        cache=get_report_cache(MagicMock(app=app)),
    )
    assert isinstance(provider, MockAnalyticsProvider)
    del real_app, require_session  # fixtures/imports kept for symmetry with the other wiring tests


def test_real_mode_requests_share_the_cache(real_app: FastAPI) -> None:
    """Two identical requests by the same user hit Google once."""
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
    assert real_app.state.report_cache.stats()["hits"] == 1
