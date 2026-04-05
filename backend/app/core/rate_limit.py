from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
from time import time

from fastapi import HTTPException, Request, status


@dataclass(frozen=True)
class RateLimitRule:
    """Simple in-memory rule for throttling expensive routes in the MVP."""

    name: str
    requests: int
    window_seconds: int


class InMemoryRateLimiter:
    """Very small process-local rate limiter keyed by client IP and action name."""

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def enforce(self, request: Request, rule: RateLimitRule) -> None:
        if rule.requests <= 0 or rule.window_seconds <= 0:
            return

        client_id = self._get_client_id(request)
        bucket_key = f"{rule.name}:{client_id}"
        now = time()
        cutoff = now - rule.window_seconds

        with self._lock:
            bucket = self._events[bucket_key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= rule.requests:
                retry_after = max(1, int(rule.window_seconds - (now - bucket[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Too many {rule.name.replace('-', ' ')} requests from this device. "
                        f"Please wait about {retry_after} seconds and try again."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )

            bucket.append(now)

    def _get_client_id(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for", "").strip()
        if forwarded_for:
            return forwarded_for.split(",")[0].strip().lower()

        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip.lower()

        if request.client and request.client.host:
            return request.client.host.lower()

        return "unknown"


rate_limiter = InMemoryRateLimiter()
