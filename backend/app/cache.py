"""
Report cache — keeps GA Data API quota usage (and latency) down.

A dashboard page fires ~8 report requests, and GA4 has daily/hourly quotas.
Caching identical queries for a few minutes means repeat visits, page switches
and filter toggles don't cost quota.

Two interchangeable backends implement ``ReportCache``:

* ``RedisCache`` — shared across processes/replicas, survives restarts; used
  when ``REDIS_URL`` is configured (see ``docker-compose.yml``).
* ``MemoryCache`` — in-process TTL + LRU; the zero-config fallback.

Both are *fail-soft*: a cache problem is logged and treated as a miss, never
surfaced to the user. Entries are keyed by the caller's identity as well as the
query so two users never see each other's data.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any, Protocol

import redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

# Values are JSON-serialisable report payloads: {"headers": [...], "rows": [[...]]}
CacheValue = dict[str, Any]


class ReportCache(Protocol):
    """Minimal cache interface shared by all backends."""

    backend: str

    @property
    def enabled(self) -> bool: ...

    def get(self, key: str) -> CacheValue | None: ...

    def set(self, key: str, value: CacheValue) -> None: ...

    def clear(self) -> None: ...

    def ping(self) -> bool:
        """True when the backend is reachable (memory is always reachable)."""
        ...

    def stats(self) -> dict[str, Any]: ...


# ── In-memory backend ─────────────────────────────────────────────────────────


class MemoryCache:
    backend = "memory"

    def __init__(
        self,
        ttl_seconds: float,
        max_entries: int = 512,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.ttl = ttl_seconds
        self.max_entries = max_entries
        self._clock = clock
        self._lock = threading.Lock()
        self._entries: OrderedDict[str, tuple[float, CacheValue]] = OrderedDict()
        self.hits = 0
        self.misses = 0

    @property
    def enabled(self) -> bool:
        return self.ttl > 0

    def get(self, key: str) -> CacheValue | None:
        if not self.enabled:
            return None
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                self.misses += 1
                return None
            expires_at, value = entry
            if expires_at <= self._clock():
                del self._entries[key]
                self.misses += 1
                return None
            self._entries.move_to_end(key)
            self.hits += 1
            return value

    def set(self, key: str, value: CacheValue) -> None:
        if not self.enabled:
            return
        with self._lock:
            self._entries[key] = (self._clock() + self.ttl, value)
            self._entries.move_to_end(key)
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def ping(self) -> bool:
        return True

    def stats(self) -> dict[str, Any]:
        return {
            "backend": self.backend,
            "enabled": self.enabled,
            "ttl_seconds": self.ttl,
            "entries": len(self),
            "hits": self.hits,
            "misses": self.misses,
        }

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)


# Backwards-compatible alias (earlier code/tests referred to TTLCache).
TTLCache = MemoryCache


# ── Redis backend ─────────────────────────────────────────────────────────────


class RedisCache:
    """
    Report cache on Redis. Each entry is a JSON blob stored with ``SET … EX`` so
    Redis handles expiry itself; keys are namespaced with ``prefix``.
    """

    backend = "redis"

    def __init__(self, client: redis.Redis, ttl_seconds: int, prefix: str = "ga:report:"):
        self._client = client
        self.ttl = ttl_seconds
        self.prefix = prefix
        self.hits = 0
        self.misses = 0
        self.errors = 0

    @classmethod
    def from_url(cls, url: str, ttl_seconds: int, prefix: str = "ga:report:", **kwargs: Any) -> RedisCache:
        client = redis.Redis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=kwargs.pop("socket_connect_timeout", 2.0),
            socket_timeout=kwargs.pop("socket_timeout", 2.0),
            **kwargs,
        )
        return cls(client, ttl_seconds, prefix)

    @property
    def enabled(self) -> bool:
        return self.ttl > 0

    def _key(self, key: str) -> str:
        return f"{self.prefix}{key}"

    def get(self, key: str) -> CacheValue | None:
        if not self.enabled:
            return None
        try:
            raw = self._client.get(self._key(key))
        except RedisError as exc:
            self.errors += 1
            logger.warning("Redis GET failed (treating as miss): %s", exc)
            return None
        if raw is None:
            self.misses += 1
            return None
        try:
            value: CacheValue = json.loads(raw)
        except (TypeError, ValueError):
            self.misses += 1
            logger.warning("Discarding corrupt cache entry %s", key)
            return None
        self.hits += 1
        return value

    def set(self, key: str, value: CacheValue) -> None:
        if not self.enabled:
            return
        try:
            self._client.set(self._key(key), json.dumps(value, separators=(",", ":")), ex=self.ttl)
        except RedisError as exc:
            self.errors += 1
            logger.warning("Redis SET failed (skipping cache write): %s", exc)

    def clear(self) -> None:
        """Delete every key in this cache's namespace (SCAN, so it's safe on large instances)."""
        try:
            batch: list[str] = []
            for k in self._client.scan_iter(match=f"{self.prefix}*", count=500):
                batch.append(k)
                if len(batch) >= 500:
                    self._client.delete(*batch)
                    batch.clear()
            if batch:
                self._client.delete(*batch)
        except RedisError as exc:
            self.errors += 1
            logger.warning("Redis clear failed: %s", exc)

    def ping(self) -> bool:
        try:
            return bool(self._client.ping())
        except RedisError as exc:
            logger.warning("Redis unreachable: %s", exc)
            return False

    def stats(self) -> dict[str, Any]:
        return {
            "backend": self.backend,
            "enabled": self.enabled,
            "ttl_seconds": self.ttl,
            "hits": self.hits,
            "misses": self.misses,
            "errors": self.errors,
        }


# ── Factory & keys ────────────────────────────────────────────────────────────


def build_cache(ttl_seconds: int, redis_url: str | None = None) -> ReportCache:
    """
    Pick a backend from configuration. Redis is used when a URL is given; if it
    can't be reached at start-up we log loudly and fall back to memory rather
    than refusing to start.
    """
    if redis_url:
        cache = RedisCache.from_url(redis_url, ttl_seconds)
        if cache.ping():
            logger.info("Report cache: redis (%s), ttl=%ss", _redacted(redis_url), ttl_seconds)
            return cache
        logger.error("Redis at %s is unreachable — falling back to in-memory cache", _redacted(redis_url))
    return MemoryCache(ttl_seconds)


def _redacted(url: str) -> str:
    """Hide credentials in ``redis://user:pass@host`` when logging."""
    if "@" in url and "://" in url:
        scheme, rest = url.split("://", 1)
        return f"{scheme}://***@{rest.rsplit('@', 1)[1]}"
    return url


def make_key(identity: str, **query: Any) -> str:
    """Stable cache key from an opaque caller identity plus the query parameters."""
    payload = json.dumps({"identity": identity, "query": query}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()
