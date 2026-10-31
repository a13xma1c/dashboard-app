"""
Tiny in-process TTL cache for GA report responses.

A dashboard page fires ~8 report requests, and GA4's Data API has daily and
hourly quotas. Caching identical queries for a few minutes keeps quota use (and
latency) down without changing what the user sees within a refresh cycle.

Entries are keyed by the *caller's identity* as well as the query so two users
never see each other's data. The cache is bounded (LRU eviction) and safe to
share across threads.
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(
        self, ttl_seconds: float, max_entries: int = 512, clock: Callable[[], float] = time.monotonic
    ):
        self.ttl = ttl_seconds
        self.max_entries = max_entries
        self._clock = clock
        self._lock = threading.Lock()
        self._entries: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self.hits = 0
        self.misses = 0

    @property
    def enabled(self) -> bool:
        return self.ttl > 0

    def get(self, key: str) -> T | None:
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

    def set(self, key: str, value: T) -> None:
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

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)


def make_key(identity: str, **query: Any) -> str:
    """Stable cache key from an opaque caller identity plus the query parameters."""
    payload = json.dumps({"identity": identity, "query": query}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()
