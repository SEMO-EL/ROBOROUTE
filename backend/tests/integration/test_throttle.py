"""Protection for a public deployment: per-client request limits and a cap on concurrent work."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from roboroute.api.app import create_app
from roboroute.api.settings import Settings
from roboroute.api.throttle import SlidingWindowLimiter, ThrottleMiddleware
from tests.factories import scenario_dict
from tests.paths import SCENARIOS_DIR


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_limiter_allows_up_to_the_limit_per_client_within_the_window() -> None:
    clock = Clock()
    limiter = SlidingWindowLimiter(limit=2, window=60.0, clock=clock)
    assert limiter.check("a") == 0.0
    assert limiter.check("a") == 0.0
    wait = limiter.check("a")
    assert 59.0 < wait <= 60.0
    assert limiter.check("b") == 0.0  # other clients are counted separately
    clock.now += 60.1
    assert limiter.check("a") == 0.0


def test_limiter_forgets_idle_clients() -> None:
    clock = Clock()
    limiter = SlidingWindowLimiter(limit=1, window=10.0, clock=clock, max_clients=3)
    for name in "abcd":
        limiter.check(name)
        clock.now += 11
    assert len(limiter.clients) <= 3


@pytest.fixture
def limited() -> TestClient:
    settings = Settings(
        examples_dir=SCENARIOS_DIR,
        cors_origins=(),
        max_body_bytes=1_000_000,
        rate_limit_per_minute=2,
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def test_heavy_requests_beyond_the_limit_get_429(limited: TestClient) -> None:
    body = {"scenario": scenario_dict()}
    assert limited.post("/api/v1/optimize", json=body).status_code == 200
    assert limited.post("/api/v1/optimize", json=body).status_code == 200
    response = limited.post("/api/v1/optimize", json=body)
    assert response.status_code == 429
    assert response.json()["code"] == "rate_limited"
    assert int(response.headers["retry-after"]) >= 1


def test_cheap_requests_are_not_limited(limited: TestClient) -> None:
    for _ in range(5):
        assert limited.get("/api/v1/health").status_code == 200
        assert limited.post("/api/v1/scenarios/validate", json=scenario_dict()).status_code == 200


def test_limits_are_off_by_default(client: TestClient) -> None:
    body = {"scenario": scenario_dict()}
    for _ in range(5):
        assert client.post("/api/v1/optimize", json=body).status_code == 200


def test_concurrent_heavy_work_waits_then_reports_busy() -> None:
    release = asyncio.Event()
    started = 0

    async def slow_app(scope, receive, send):  # type: ignore[no-untyped-def]
        nonlocal started
        started += 1
        await release.wait()
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    middleware = ThrottleMiddleware(slow_app, max_concurrent=1, wait_seconds=0.05)
    scope = {"type": "http", "method": "POST", "path": "/api/v1/simulate", "client": ("x", 1)}

    async def call() -> list[dict[str, object]]:
        sent: list[dict[str, object]] = []

        async def receive():  # type: ignore[no-untyped-def]
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):  # type: ignore[no-untyped-def]
            sent.append(message)

        await middleware(scope, receive, send)
        return sent

    async def scenario() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
        first = asyncio.create_task(call())
        await asyncio.sleep(0)  # let the first request take the only slot
        second = await call()  # cannot get a slot within 0.05 s
        release.set()
        return await first, second

    first, second = asyncio.run(scenario())
    assert first[0]["status"] == 200
    assert second[0]["status"] == 503
    assert b"busy" in second[1]["body"]  # type: ignore[operator]
    assert started == 1
