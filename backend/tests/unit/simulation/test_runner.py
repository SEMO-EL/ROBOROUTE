import math
from typing import Any

import numpy as np
import pytest

from roboroute.engine.models import Scenario
from roboroute.engine.models.simulation import SimulationConfig
from roboroute.engine.optimization.dp import solve
from roboroute.engine.optimization.instance import compile_instance
from roboroute.engine.optimization.plan import evaluate
from roboroute.engine.scenarios import load_scenario
from roboroute.engine.simulation.runner import PlanError, simulate
from roboroute.engine.travel.matrix import build_travel_matrix
from tests.factories import scenario_dict
from tests.paths import SCENARIOS_DIR


def deterministic(data: dict[str, Any]) -> dict[str, Any]:
    """Fixed durations, one attempt, certain success."""
    for mission in data["missions"]:
        mission["execution_time"] = {"kind": "fixed", "value": 5.0}
        mission["success"] = {"kind": "probability", "p": 1.0}
        mission["max_attempts"] = 1
    return data


def setup(data: dict[str, Any]):  # type: ignore[no-untyped-def]
    scenario = Scenario.model_validate(data)
    matrix = build_travel_matrix(scenario)
    return scenario, compile_instance(scenario, matrix)


NO_NOISE = SimulationConfig(trials=50, seed=1, travel_time_cv=0.0)


def test_deterministic_simulation_reproduces_the_planning_model() -> None:
    scenario, instance = setup(deterministic(scenario_dict()))
    trials = simulate(scenario, instance, [["m1", "m2"]], NO_NOISE)
    plan = evaluate(instance, [[0, 1]])
    assert plan is not None
    assert np.allclose(trials.completion_time, plan.completion_time)
    assert np.allclose(trials.score, 20 + 35 + 10)
    assert not trials.cut_off.any()


def test_multi_run_return_and_reset_time() -> None:
    data = deterministic(scenario_dict())
    data["constraints"] = []
    data["format"] = {"kind": "multi_run", "time_budget": 150, "reset_time": 4.0}
    scenario, instance = setup(data)
    trials = simulate(scenario, instance, [["m1"], ["m2"]], NO_NOISE)
    plan = evaluate(instance, [[0], [1]])
    assert plan is not None
    assert np.allclose(trials.completion_time, plan.completion_time)


def test_failed_requirement_skips_dependent_mission() -> None:
    data = deterministic(scenario_dict())
    data["missions"][0]["success"] = {"kind": "probability", "p": 0.0}
    scenario, instance = setup(data)
    trials = simulate(scenario, instance, [["m1", "m2"]], NO_NOISE)
    assert not trials.attempted[:, 1].any()
    alone = evaluate(instance, [[0]])
    assert alone is not None
    assert np.allclose(trials.completion_time, alone.completion_time)  # no travel to m2


def _tight_m2() -> dict[str, Any]:
    """Budget 60 s; m2 lasts long enough to fit on its own but not after m1."""
    data = deterministic(scenario_dict())
    data["format"]["time_budget"] = 60.0
    scenario = Scenario.model_validate(data)
    matrix = build_travel_matrix(scenario)
    alone = matrix.seconds("start", "m2")
    after_m1 = matrix.seconds("start", "m1") + 5.0 + matrix.seconds("m1", "m2")
    assert after_m1 > alone + 2  # precondition for the construction below
    data["missions"][1]["execution_time"] = {"kind": "fixed", "value": 60.0 - alone - 1.0}
    return data


def test_mission_running_into_the_buzzer_scores_nothing() -> None:
    scenario, instance = setup(_tight_m2())
    config = SimulationConfig(
        trials=10, seed=1, travel_time_cv=0.0, skip_if_insufficient_time=False
    )
    trials = simulate(scenario, instance, [["m1", "m2"]], config)
    assert trials.cut_off.all()
    assert trials.started[:, 1].all()
    assert np.allclose(trials.score, 20)  # m2 was still in progress at the buzzer
    assert np.allclose(trials.completion_time, 60.0)


def test_skip_when_remaining_time_is_insufficient() -> None:
    scenario, instance = setup(_tight_m2())
    trials = simulate(
        scenario, instance, [["m1", "m2"]], SimulationConfig(trials=10, seed=1, travel_time_cv=0.0)
    )
    assert not trials.cut_off.any()
    assert trials.skipped_for_time.all()
    assert not trials.started[:, 1].any()
    assert np.allclose(trials.score, 20)


def test_retries_raise_the_success_rate() -> None:
    data = deterministic(scenario_dict())
    data["constraints"] = []
    data["missions"][0]["success"] = {"kind": "probability", "p": 0.5}
    data["missions"][0]["max_attempts"] = 2
    scenario, instance = setup(data)
    trials = simulate(
        scenario, instance, [["m1"]], SimulationConfig(trials=40_000, seed=7, travel_time_cv=0.0)
    )
    rate = trials.succeeded[:, 0].mean()
    se = math.sqrt(0.75 * 0.25 / 40_000)
    assert abs(rate - 0.75) <= 5 * se


def test_same_seed_same_results_different_seed_different() -> None:
    scenario, instance = setup(scenario_dict())
    config = SimulationConfig(trials=500, seed=11)
    a = simulate(scenario, instance, [["m1", "m2"]], config)
    b = simulate(scenario, instance, [["m1", "m2"]], config)
    c = simulate(scenario, instance, [["m1", "m2"]], config.model_copy(update={"seed": 12}))
    np.testing.assert_array_equal(a.score, b.score)
    np.testing.assert_array_equal(a.completion_time, b.completion_time)
    assert not np.array_equal(a.completion_time, c.completion_time)


def test_unknown_or_infeasible_plan_rejected() -> None:
    scenario, instance = setup(scenario_dict())
    with pytest.raises(PlanError, match="ghost"):
        simulate(scenario, instance, [["ghost"]], NO_NOISE)
    with pytest.raises(PlanError, match="order"):
        simulate(scenario, instance, [["m2", "m1"]], NO_NOISE)


@pytest.mark.parametrize("name", ["a-simple-arena", "d-complex"])
def test_simulated_mean_converges_to_analytic_expectation(name: str) -> None:
    """Design doc §9.5: with no buzzer cut-offs, the Monte Carlo mean must match E[score]."""
    scenario = load_scenario(SCENARIOS_DIR / f"{name}.json")
    relaxed = scenario.model_copy(
        update={"format": scenario.format.model_copy(update={"time_budget": 600.0})}
    )
    matrix = build_travel_matrix(relaxed)
    instance = compile_instance(relaxed, matrix)
    plan = solve(instance).best
    runs = [[instance.ids[i] for i in run] for run in plan.runs]
    trials = simulate(
        relaxed, instance, runs, SimulationConfig(trials=50_000, seed=3, travel_time_cv=0.1)
    )
    assert not trials.cut_off.any()
    se = trials.score.std(ddof=1) / math.sqrt(trials.score.size)
    assert abs(trials.score.mean() - plan.expected_score) <= 5 * se
