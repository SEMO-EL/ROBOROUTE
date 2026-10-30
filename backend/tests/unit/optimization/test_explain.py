import pytest

from roboroute.engine.models import Scenario
from roboroute.engine.optimization.dp import solve
from roboroute.engine.optimization.explain import explain, speed_sensitivity
from roboroute.engine.optimization.instance import compile_instance
from roboroute.engine.travel.matrix import build_travel_matrix
from tests.factories import scenario_dict
from tests.unit.optimization.factory import simple_instance


def test_counterfactuals_for_the_greedy_trap() -> None:
    instance = simple_instance([10, 90], [10, 95], budget=100)
    explanation = explain(instance, solve(instance))
    by_id = {v.mission: v for v in explanation.verdicts}
    assert by_id["m1"].selected
    assert by_id["m1"].counterfactual_score == pytest.approx(10)  # best plan without it
    assert by_id["m1"].delta == pytest.approx(-80)
    assert not by_id["m0"].selected
    assert by_id["m0"].counterfactual_score == pytest.approx(10)  # best plan with it
    assert "10.0" in by_id["m0"].reason


def test_mission_that_never_fits_with_others() -> None:
    instance = simple_instance([10, 90], [60, 60], budget=100)
    explanation = explain(instance, solve(instance))
    loser = next(v for v in explanation.verdicts if not v.selected)
    assert loser.counterfactual_score is not None
    assert "instead of" in loser.reason


def test_time_breakdown_and_slack() -> None:
    instance = simple_instance([10, 20], [10, 20], budget=50, travel=3)
    explanation = explain(instance, solve(instance))
    assert explanation.mission_seconds == pytest.approx(30)
    assert explanation.travel_seconds == pytest.approx(6)
    assert explanation.slack == pytest.approx(50 - 36)


def test_optional_mission_is_called_optional() -> None:
    instance = simple_instance([10, 0], [5, 5], budget=100)
    explanation = explain(instance, solve(instance))
    assert all(v.mission != "m1" or not v.selected for v in explanation.verdicts)


def test_faster_robot_never_scores_less() -> None:
    scenario = Scenario.model_validate(scenario_dict())
    matrix = build_travel_matrix(scenario)
    instance = compile_instance(scenario, matrix)
    rows = speed_sensitivity(scenario, matrix, instance, [0.5, 1.0, 2.0])
    scores = [row.best_score for row in rows]
    assert scores == sorted(scores)
    assert rows[1].same_selection_as_baseline
