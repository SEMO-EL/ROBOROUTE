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


def test_dp_summary(client: TestClient) -> None:
    body = optimize(client, load("b-medium"))
    summary = body["dp_summary"]
    assert summary["missions"] == 7
    assert summary["subsets"] == 2**7
    assert 0 < summary["feasible_subsets"] <= 2**7
    best = summary["best_sets"][0]
    assert best["expected_score"] == body["optimal"]["expected_score"]
    assert sorted(best["missions"]) == sorted(m for run in body["optimal"]["runs"] for m in run)


def test_left_out_for_lack_of_time_is_not_blamed_on_the_rules(client: TestClient) -> None:
    # beacon and bridge take 60 s each in a 120 s match, and bridge requires beacon.
    scenario = load("a-simple-arena")
    for mission in scenario["missions"][:2]:
        mission["execution_time"] = {"kind": "fixed", "value": 60}
    scenario["constraints"] = [{"kind": "requires", "before": "beacon", "after": "bridge"}]
    verdicts = {v["mission"]: v for v in optimize(client, scenario)["explanation"]["verdicts"]}
    assert not verdicts["bridge"]["selected"]
    assert "120 s budget" in verdicts["bridge"]["reason"]


def test_speed_factors_must_be_positive(client: TestClient) -> None:
    body = {"scenario": load("a-simple-arena"), "settings": {"sensitivity_factors": [0]}}
    assert client.post("/api/v1/optimize", json=body).status_code == 422
