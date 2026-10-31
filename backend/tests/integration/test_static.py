"""Production mode: the API also serves the built single-page app."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from roboroute.api.app import create_app
from roboroute.api.settings import Settings
from tests.paths import SCENARIOS_DIR

INDEX = "<!doctype html><title>RoboRoute</title><div id=root></div>"


@pytest.fixture
def site(tmp_path: Path) -> Path:
    static = tmp_path / "dist"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text(INDEX)
    (static / "assets" / "app-1a2b3c.js").write_text("console.log('app')")
    (tmp_path / "secret.txt").write_text("outside the static directory")
    return static


@pytest.fixture
def spa(site: Path) -> TestClient:
    settings = Settings(
        examples_dir=SCENARIOS_DIR,
        cors_origins=(),
        max_body_bytes=1_000_000,
        static_dir=site,
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def test_index_and_client_side_routes_return_the_app(spa: TestClient) -> None:
    for path in ("/", "/learn", "/arena", "/experiments?x=1"):
        response = spa.get(path)
        assert response.status_code == 200, path
        assert response.text == INDEX
        assert response.headers["cache-control"] == "no-cache"


def test_hashed_assets_are_served_with_long_caching(spa: TestClient) -> None:
    response = spa.get("/assets/app-1a2b3c.js")
    assert response.status_code == 200
    assert response.text == "console.log('app')"
    assert "javascript" in response.headers["content-type"]
    assert "immutable" in response.headers["cache-control"]


def test_missing_asset_is_a_404_not_the_app(spa: TestClient) -> None:
    assert spa.get("/assets/missing.js").status_code == 404


def test_unknown_api_path_is_a_json_404(spa: TestClient) -> None:
    response = spa.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert spa.get("/api/v1/health").json() == {"status": "ok"}


@pytest.mark.parametrize(
    "path", ["/../secret.txt", "/assets/../../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt"]
)
def test_paths_cannot_escape_the_static_directory(spa: TestClient, path: str) -> None:
    response = spa.get(path)
    assert "outside the static directory" not in response.text


def test_security_headers_on_app_and_api(spa: TestClient) -> None:
    for path in ("/", "/api/v1/health"):
        headers = spa.get(path).headers
        assert headers["x-content-type-options"] == "nosniff"
        assert headers["x-frame-options"] == "DENY"
        assert headers["referrer-policy"] == "no-referrer"
        csp = headers["content-security-policy"]
        assert "default-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp
        assert "unsafe-eval" not in csp


def test_without_a_static_directory_only_the_api_is_served(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_embedding_can_be_allowed_for_named_sites(site: Path) -> None:
    settings = Settings(
        examples_dir=SCENARIOS_DIR,
        cors_origins=(),
        max_body_bytes=1_000_000,
        static_dir=site,
        frame_ancestors=("https://huggingface.co",),
    )
    headers = TestClient(create_app(settings)).get("/").headers
    assert "frame-ancestors 'self' https://huggingface.co" in headers["content-security-policy"]
    # X-Frame-Options cannot name another site; the CSP directive takes over.
    assert "x-frame-options" not in headers
