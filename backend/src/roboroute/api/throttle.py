"""Protection for a public deployment: per-client request limits and a cap on concurrent work.

Only the computation endpoints (routes, optimisation, simulation) are limited; health checks,
examples and the live validation used while editing are cheap and stay unlimited.

- **Rate limit:** at most ``rate_limit_per_minute`` heavy requests per client address in any
  sliding 60-second window; beyond that, 429 with ``Retry-After``. A whole classroom often shares
  one public address, so the limit should be generous.
- **Concurrency cap:** at most ``max_concurrent`` heavy requests run at once (a small server has
  little CPU); others wait up to ``wait_seconds`` for a slot, then get 503 "busy".

Both are off unless configured. State is in memory, which suits the single-instance deployment
this is designed for.
"""

import asyncio
import math
import time
from collections import deque
from collections.abc import Callable

from starlette.types import ASGIApp, Receive, Scope, Send

from roboroute.api.errors import error_response

HEAVY_PREFIXES = ("/api/v1/routes/", "/api/v1/optimize", "/api/v1/simulate")


class SlidingWindowLimiter:
    def __init__(
        self,
        limit: int,
        window: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
        max_clients: int = 10_000,
    ) -> None:
        self.limit = limit
        self.window = window
        self.clock = clock
        self.max_clients = max_clients
        self.clients: dict[str, deque[float]] = {}

    def check(self, client: str) -> float:
        """Records a request; returns 0 if allowed, otherwise the seconds until one is allowed."""
        now = self.clock()
        if len(self.clients) >= self.max_clients:
            self._forget_idle(now)
        times = self.clients.setdefault(client, deque())
        while times and times[0] <= now - self.window:
            times.popleft()
        if len(times) >= self.limit:
            return times[0] + self.window - now
        times.append(now)
        return 0.0

    def _forget_idle(self, now: float) -> None:
        for name in [n for n, t in self.clients.items() if not t or t[-1] <= now - self.window]:
            del self.clients[name]


class ThrottleMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        rate_limit_per_minute: int = 0,
        max_concurrent: int = 0,
        wait_seconds: float = 30.0,
    ) -> None:
        self.app = app
        self.limiter = (
            SlidingWindowLimiter(rate_limit_per_minute) if rate_limit_per_minute > 0 else None
        )
        self.slots = asyncio.Semaphore(max_concurrent) if max_concurrent > 0 else None
        self.wait_seconds = wait_seconds

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith(HEAVY_PREFIXES):
            await self.app(scope, receive, send)
            return
        if self.limiter is not None:
            client = scope.get("client")
            wait = self.limiter.check(client[0] if client else "unknown")
            if wait > 0:
                seconds = max(1, math.ceil(wait))
                response = error_response(
                    429,
                    "rate_limited",
                    f"Too many calculations from your network. Try again in {seconds} s.",
                    {"retry_after": seconds},
                )
                response.headers["retry-after"] = str(seconds)
                await response(scope, receive, send)
                return
        if self.slots is None:
            await self.app(scope, receive, send)
            return
        try:
            await asyncio.wait_for(self.slots.acquire(), timeout=self.wait_seconds)
        except TimeoutError:
            response = error_response(
                503, "busy", "The server is busy with other calculations. Try again shortly."
            )
            response.headers["retry-after"] = "5"
            await response(scope, receive, send)
            return
        try:
            await self.app(scope, receive, send)
        finally:
            self.slots.release()
