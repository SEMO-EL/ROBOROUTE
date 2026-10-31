from fastapi import FastAPI
from fastapi.testclient import TestClient

from roboroute.api.app import create_app
from roboroute.api.settings import Settings
from tests.factories import scenario_dict


def test_validate_accepts_valid_scenario(client: TestClient) -> None:
    response = client.post("/api/v1/scenarios/validate", json=scenario_dict())
    assert response.status_code == 200
    assert response.json() == {"valid": True, "issues": []}


def test_validate_reports_unknown_reference(client: TestClient) -> None:
    data = scenario_dict()
    data["constraints"][0]["after"] = "ghost"
    body = client.post("/api/v1/scenarios/validate", json=data).json()
    assert body["valid"] is False
    issue = next(i for i in body["issues"] if i["code"] == "unknown_mission")
    assert issue["path"] == ["constraints", 0, "after"]
    assert "ghost" in issue["message"]


def test_validate_reports_field_errors_with_path(client: TestClient) -> None:
    data = scenario_dict()
    data["robot"]["length"] = -1
    body = client.post("/api/v1/scenarios/validate", json=data).json()
    assert body["valid"] is False
    assert ["robot", "length"] in [i["path"] for i in body["issues"]]


def test_validate_rejects_non_object_body(client: TestClient) -> None:
    response = client.post("/api/v1/scenarios/validate", json=[1, 2, 3])
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_request"


def test_malformed_json_returns_structured_error(client: TestClient) -> None:
    response = client.post(
        "/api/v1/scenarios/validate",
        content=b"{not json",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "invalid_request"
    assert "Traceback" not in response.text


def test_body_too_large_returns_413(settings: Settings) -> None:
    small = Settings(examples_dir=settings.examples_dir, cors_origins=(), max_body_bytes=100)
    client = TestClient(create_app(small), raise_server_exceptions=False)
    response = client.post("/api/v1/scenarios/validate", json=scenario_dict())
    assert response.status_code == 413
    assert response.json()["code"] == "payload_too_large"


def test_internal_error_hides_details(settings: Settings) -> None:
    app: FastAPI = create_app(settings)

    @app.get("/api/v1/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/v1/boom")
    assert response.status_code == 500
    assert response.json()["code"] == "internal_error"
    assert "secret" not in response.text


def test_validate_reports_constraint_cycle_as_error(client: TestClient) -> None:
    data = scenario_dict()
    data["constraints"].append({"kind": "precedes", "before": "m2", "after": "m1"})
    body = client.post("/api/v1/scenarios/validate", json=data).json()
    assert body["valid"] is False
    assert [i["code"] for i in body["issues"]] == ["constraint_cycle"]


def test_validate_reports_impossible_mission_as_warning(client: TestClient) -> None:
    data = scenario_dict()
    data["constraints"].append({"kind": "excludes", "a": "m1", "b": "m2"})
    body = client.post("/api/v1/scenarios/validate", json=data).json()
    assert body["valid"] is True  # warnings do not make a scenario invalid
    assert body["issues"][0]["code"] == "impossible_mission"
    assert body["issues"][0]["severity"] == "warning"
