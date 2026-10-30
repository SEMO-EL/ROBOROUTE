import numpy
from fastapi.testclient import TestClient

import roboroute


def test_health(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_version_reports_versions(client: TestClient) -> None:
    body = client.get("/api/v1/version").json()
    assert body["version"] == roboroute.__version__
    assert body["numpy"] == numpy.__version__
    assert body["python"].count(".") == 2


def test_cors_allows_configured_origin(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_ignores_unknown_origin(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers
