from fastapi.testclient import TestClient


def test_examples_list_contains_scenario_a(client: TestClient) -> None:
    response = client.get("/api/v1/examples")
    assert response.status_code == 200
    summaries = response.json()
    assert {"id", "name", "description"} <= summaries[0].keys()
    assert "a-simple-arena" in [s["id"] for s in summaries]


def test_example_detail_returns_scenario(client: TestClient) -> None:
    response = client.get("/api/v1/examples/a-simple-arena")
    assert response.status_code == 200
    body = response.json()
    assert body["fictional"] is True
    assert len(body["missions"]) == 3


def test_unknown_example_returns_404_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/examples/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert "does-not-exist" in body["message"]
