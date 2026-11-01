import json

from fastapi.testclient import TestClient

from tests.paths import SCENARIOS_DIR


def scenario_a() -> dict[str, object]:
    data: dict[str, object] = json.loads((SCENARIOS_DIR / "a-simple-arena.json").read_text())
    return data


def test_plan_route_between_nodes(client: TestClient) -> None:
    body = {"scenario": scenario_a(), "from_node": "start", "to_node": "bridge"}
    response = client.post("/api/v1/routes/plan", json=body)
    assert response.status_code == 200
    route = response.json()
    assert route["status"] == "ok"
    assert route["smoothed_points"][0] == [0.2, 0.2]
    assert route["smoothed_points"][-1] == [1.1, 1.0]
    assert route["length_smoothed"] <= route["length_raw"]
    assert route["search"]["optimality_guaranteed"] is True
    assert route["timing"]["total"] > 0
    assert route["trace"] is None


def test_plan_route_with_trace(client: TestClient) -> None:
    body = {
        "scenario": scenario_a(),
        "from_node": "start",
        "to_node": "beacon",
        "options": {"algorithm": "astar", "heuristic": "octile", "connectivity": 8},
        "include_trace": True,
        "trace_limit": 50,
    }
    route = client.post("/api/v1/routes/plan", json=body).json()
    trace = route["trace"]
    assert len(trace["events"]) <= 50
    first = trace["events"][0]
    assert first["kind"] == "expand"
    assert {"cell", "g", "h", "f"} <= first.keys()
    assert first["cell"] == route["start_cell"]
    assert route["grid_path"][0] == route["start_cell"]
    assert route["grid_path"][-1] == route["goal_cell"]


def test_unknown_node_is_a_422(client: TestClient) -> None:
    body = {"scenario": scenario_a(), "from_node": "start", "to_node": "nowhere"}
    response = client.post("/api/v1/routes/plan", json=body)
    assert response.status_code == 422
    assert response.json()["code"] == "unknown_node"


def test_invalid_scenario_in_route_request_is_a_422(client: TestClient) -> None:
    scenario = scenario_a()
    scenario["missions"] = "not a list"
    body = {"scenario": scenario, "from_node": "start", "to_node": "bridge"}
    assert client.post("/api/v1/routes/plan", json=body).status_code == 422


def test_matrix(client: TestClient) -> None:
    response = client.post("/api/v1/routes/matrix", json={"scenario": scenario_a()})
    assert response.status_code == 200
    matrix = response.json()
    assert matrix["nodes"] == ["start", "beacon", "bridge", "crane"]
    assert len(matrix["legs"]) == 12
    assert matrix["failures"] == []
    assert {leg["provenance"] for leg in matrix["legs"]} == {"modeled"}


def test_grid(client: TestClient) -> None:
    grid = client.post("/api/v1/routes/grid", json={"scenario": scenario_a()}).json()
    assert (grid["columns"], grid["rows"]) == (100, 60)
    blocked = sum(run[2] for run in grid["blocked_runs"])
    assert blocked + grid["free_count"] == 100 * 60


def test_calibration_fit(client: TestClient) -> None:
    body = {
        "kind": "linear",
        "measurements": [{"amount": 0.2, "seconds": 1.2}, {"amount": 1.0, "seconds": 3.6}],
    }
    result = client.post("/api/v1/calibration/fit", json=body).json()
    assert abs(result["max_speed"] - 1 / 3) < 1e-9
    assert result["model"] == "trapezoidal"


def test_calibration_refuses_an_impossible_speed(client: TestClient) -> None:
    body = {"kind": "linear", "measurements": [{"amount": 10, "seconds": 0.1}]}
    response = client.post("/api/v1/calibration/fit", json=body)
    assert response.status_code == 422
    assert response.json()["code"] == "implausible_calibration"
