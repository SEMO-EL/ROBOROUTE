from typing import Any

import pytest

from roboroute.engine.models import Scenario
from roboroute.engine.optimization.instance import PlanningError, compile_instance
from roboroute.engine.travel.matrix import build_travel_matrix
from tests.factories import scenario_dict


def _compile(data: dict[str, Any]):  # type: ignore[no-untyped-def]
    scenario = Scenario.model_validate(data)
    return compile_instance(scenario, build_travel_matrix(scenario))


def test_candidates_durations_and_probabilities() -> None:
    instance = _compile(scenario_dict())
    assert instance.ids == ["m1", "m2"]
    assert instance.tau.shape == (3, 3)
    assert instance.duration[0] == pytest.approx(5.0)
    # Triangular(4, 6, 10) has mean 20/3; two attempts are budgeted.
    assert instance.duration[1] == pytest.approx(2 * 20 / 3)
    assert instance.p_eventual[0] == pytest.approx(0.9)
    # 8/10 in practice → (8+1)/(10+2) = 0.75 per attempt; two attempts → 1 − 0.25².
    assert instance.p_eventual[1] == pytest.approx(1 - 0.25**2)


def test_requirement_masks() -> None:
    instance = _compile(scenario_dict())
    assert instance.requires_mask == [0, 0b01]
    assert instance.after_mask == [0b10, 0]


def test_expected_score_with_dependency_and_bonus() -> None:
    instance = _compile(scenario_dict())
    p1, p2 = 0.9, 1 - 0.25**2
    assert instance.expected_score(0b01) == pytest.approx(20 * p1)
    # m2 only scores if m1 succeeded ("succeeded" semantics); the bonus needs both.
    expected = 20 * p1 + 35 * p1 * p2 + 10 * p1 * p2
    assert instance.expected_score(0b11) == pytest.approx(expected)
    assert instance.expected_scores()[0b11] == pytest.approx(expected)


def test_attempted_semantics_does_not_multiply_probabilities() -> None:
    data = scenario_dict()
    data["constraints"][0]["semantics"] = "attempted"
    instance = _compile(data)
    p1, p2 = 0.9, 1 - 0.25**2
    assert instance.expected_score(0b11) == pytest.approx(20 * p1 + 35 * p2 + 10 * p1 * p2)


def test_failure_penalty_only_when_attempted_and_failed() -> None:
    data = scenario_dict()
    data["scoring"]["rules"] = [{"kind": "failure_penalty", "mission": "m2", "points": 8}]
    instance = _compile(data)
    p1, p2 = 0.9, 1 - 0.25**2
    # m2 is attempted only if m1 succeeded; it fails with probability 1 − P₂.
    assert instance.expected_score(0b11) == pytest.approx(-8 * p1 * (1 - p2))


def test_unreachable_excluded() -> None:
    data = scenario_dict()
    data["missions"][0]["approach_pose"] = {"x": 1.0, "y": 0.6, "theta": 0.0}  # inside the wall
    instance = _compile(data)
    assert instance.ids == []
    assert "too close to an obstacle" in instance.excluded["m1"]
    # m2 requires m1, so it is excluded too, with a reason that names m1.
    assert "'m1'" in instance.excluded["m2"]


def test_mission_too_long_for_budget_excluded() -> None:
    data = scenario_dict()
    data["format"]["time_budget"] = 8.0
    instance = _compile(data)
    assert "m1" not in instance.ids
    assert "time budget" in instance.excluded["m1"]


def test_cycle_refused() -> None:
    data = scenario_dict()
    data["constraints"].append({"kind": "precedes", "before": "m2", "after": "m1"})
    with pytest.raises(PlanningError) as excinfo:
        _compile(data)
    assert excinfo.value.issues[0].code == "constraint_cycle"
