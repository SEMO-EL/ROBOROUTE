import json

import anyio
import anyio.to_thread
import pytest
from fastapi.testclient import TestClient

from roboroute.api import browser
from roboroute.api.app import create_app
from roboroute.api.settings import Settings
from tests.paths import SCENARIOS_DIR

JSON = [("content-type", "application/json")]


def request(settings: Settings, method: str, url: str, body: object = None) -> tuple[int, bytes]:
    app = create_app(settings)
    raw = b"" if body is None else json.dumps(body).encode()
    status, _, content = anyio.run(browser.handle, app, method, url, JSON, raw)
    return status, content


@pytest.fixture(autouse=True)
def without_threads(monkeypatch: pytest.MonkeyPatch) -> None:
    """As in Pyodide: no thread pool. monkeypatch restores it after each test."""
    monkeypatch.setattr(anyio.to_thread, "run_sync", anyio.to_thread.run_sync)
    browser.run_without_threads()


def test_matches_the_server(settings: Settings, client: TestClient) -> None:
    scenario = json.loads((SCENARIOS_DIR / "b-medium.json").read_text())
    status, content = request(settings, "POST", "/api/v1/optimize", {"scenario": scenario})
    in_browser = json.loads(content)
    on_server = client.post("/api/v1/optimize", json={"scenario": scenario}).json()
    assert status == 200
    for result in (in_browser, on_server):
        del result["compute_seconds"]
    assert in_browser == on_server


def test_query_strings_and_errors(settings: Settings) -> None:
    status, content = request(settings, "GET", "http://x/api/v1/examples/missing?unused=1")
    assert status == 404
    assert json.loads(content)["code"]

    status, content = request(settings, "POST", "/api/v1/optimize", {"scenario": 1})
    assert status == 422
    assert json.loads(content)["code"]
