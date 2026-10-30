import json
from typing import Any

from fastapi.testclient import TestClient

from tests.paths import SCENARIOS_DIR


def load(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((SCENARIOS_DIR / f"{name}.json").read_text())
    return data


def optimize(client: TestClient, scenario: dict[str, Any]) -> dict[str, Any]:
    response = client.post("/api/v1/optimize", json={"scenario": scenario})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def test_optimize_scenario_a(client: TestClient) -> None:
    body = optimize(client, load("a-simple-arena"))
    assert body["candidates"] == ["beacon", "bridge", "crane"]
    optimal = body["optimal"]
    assert optimal["completion_time"] <= 120
    assert optimal["expected_score"] >= body["greedy"]["expected_score"] - 1e-9
    assert {v["mission"] for v in body["explanation"]["verdicts"]} == {"beacon", "bridge", "crane"}
    assert len(body["sensitivity"]) == 4
    assert any("mean" in note for note in body["assumptions"])
    # Every travel step has route geometry to draw.
    travel = [s for s in optimal["steps"] if s["kind"] == "travel"]
    assert len(optimal["route"]) == len(travel)


def test_scenario_b_needs_selection(client: TestClient) -> None:
    body = optimize(client, load("b-medium"))
    assert len(body["candidates"]) == 7
    chosen = {m for run in body["optimal"]["runs"] for m in run}
    assert 0 < len(chosen) < 7  # the budget forces a choice


def test_scenario_d_respects_constraints(client: TestClient) -> None:
    body = optimize(client, load("d-complex"))
    order = [m for run in body["optimal"]["runs"] for m in run]
    if "gate" in order:
        assert "key" in order
        assert order.index("key") < order.index("gate")
    if "ramp" in order and "bridge" in order:
        assert order.index("ramp") < order.index("bridge")
    assert not {"dock-a", "dock-b"} <= set(order)
    assert body["optimal"]["expected_score"] >= body["greedy"]["expected_score"] - 1e-9


def test_cycle_is_a_422_with_issues(client: TestClient) -> None:
    scenario = load("d-complex")
    scenario["constraints"].append({"kind": "precedes", "before": "bridge", "after": "ramp"})
    response = client.post("/api/v1/optimize", json={"scenario": scenario})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "invalid_constraints"
    assert "bridge" in body["details"][0]["message"]
