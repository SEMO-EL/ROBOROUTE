import json
from typing import Any

from fastapi.testclient import TestClient

from tests.paths import SCENARIOS_DIR


def load(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((SCENARIOS_DIR / f"{name}.json").read_text())
    return data


def optimal_runs(client: TestClient, scenario: dict[str, Any]) -> tuple[Any, Any]:
    body = client.post("/api/v1/optimize", json={"scenario": scenario}).json()
    return body["optimal"]["runs"], body["greedy"]["runs"]


def test_simulate_one_plan(client: TestClient) -> None:
    scenario = load("a-simple-arena")
    runs, _ = optimal_runs(client, scenario)
    body = {
        "scenario": scenario,
        "plans": [{"label": "optimal", "runs": runs}],
        "config": {"trials": 2000, "seed": 5, "target_score": 50},
    }
    response = client.post("/api/v1/simulate", json=body)
    assert response.status_code == 200, response.text
    result = response.json()
    plan = result["plans"][0]
    summary = plan["score"]
    assert summary["mean_ci"]["low"] <= summary["mean"] <= summary["mean_ci"]["high"]
    assert plan["probability_target"]["estimate"] >= 0
    assert sum(plan["score_histogram"]["counts"]) == 2000
    assert {m["mission"] for m in plan["missions"]} == {m for run in runs for m in run}
    assert plan["analytic_expected_score"] > 0
    assert result["metadata"]["seed"] == 5
    assert len(result["metadata"]["input_hash"]) == 64
    assert result["differences"] == []


def test_simulation_is_reproducible(client: TestClient) -> None:
    scenario = load("a-simple-arena")
    runs, _ = optimal_runs(client, scenario)
    body = {
        "scenario": scenario,
        "plans": [{"label": "x", "runs": runs}],
        "config": {"trials": 500, "seed": 9},
    }
    first = client.post("/api/v1/simulate", json=body).json()
    second = client.post("/api/v1/simulate", json=body).json()
    assert first["plans"] == second["plans"]


def test_compare_optimal_and_greedy(client: TestClient) -> None:
    scenario = load("d-complex")
    optimal, greedy = optimal_runs(client, scenario)
    body = {
        "scenario": scenario,
        "plans": [{"label": "optimal", "runs": optimal}, {"label": "greedy", "runs": greedy}],
        "config": {"trials": 3000, "seed": 1},
    }
    result = client.post("/api/v1/simulate", json=body).json()
    difference = result["differences"][0]
    assert difference["plan"] == "greedy"
    assert difference["reference"] == "optimal"
    assert difference["interval"]["low"] <= difference["mean"] <= difference["interval"]["high"]


def test_invalid_plan_is_a_422(client: TestClient) -> None:
    body = {
        "scenario": load("a-simple-arena"),
        "plans": [{"label": "bad", "runs": [["ghost"]]}],
        "config": {"trials": 10},
    }
    response = client.post("/api/v1/simulate", json=body)
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_plan"
    assert "ghost" in response.json()["message"]


def test_total_trials_limited(client: TestClient) -> None:
    scenario = load("a-simple-arena")
    plan = {"label": "p", "runs": [["beacon"]]}
    body = {"scenario": scenario, "plans": [plan] * 3, "config": {"trials": 50_000}}
    response = client.post("/api/v1/simulate", json=body)
    assert response.status_code == 422
    assert response.json()["code"] == "too_many_trials"
