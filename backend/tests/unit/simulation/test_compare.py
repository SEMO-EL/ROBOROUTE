import numpy as np
import pytest

from roboroute.engine.models import Scenario
from roboroute.engine.models.simulation import SimulationConfig
from roboroute.engine.optimization.dp import solve
from roboroute.engine.optimization.greedy import greedy
from roboroute.engine.optimization.instance import PlanningInstance, compile_instance
from roboroute.engine.scenarios import load_scenario
from roboroute.engine.simulation.compare import compare
from roboroute.engine.simulation.runner import simulate
from roboroute.engine.travel.matrix import build_travel_matrix
from tests.paths import SCENARIOS_DIR

Runs = list[list[str]]


def _setup() -> tuple[Scenario, PlanningInstance, Runs, Runs]:
    scenario = load_scenario(SCENARIOS_DIR / "d-complex.json")
    instance = compile_instance(scenario, build_travel_matrix(scenario))
    best, baseline = solve(instance).best, greedy(instance)
    optimal = [[instance.ids[i] for i in run] for run in best.runs]
    greedy_runs = [[instance.ids[i] for i in run] for run in baseline.runs]
    return scenario, instance, optimal, greedy_runs


def test_plan_compared_with_itself_differs_by_exactly_zero() -> None:
    scenario, instance, optimal, _ = _setup()
    result = compare(
        scenario, instance, [("a", optimal), ("b", optimal)], SimulationConfig(trials=2000, seed=4)
    )
    difference = result.differences[0]
    assert difference.mean == 0.0
    assert difference.interval.low == difference.interval.high == 0.0


def test_common_random_numbers_reduce_noise() -> None:
    scenario, instance, optimal, baseline = _setup()
    config = SimulationConfig(trials=5000, seed=4)
    paired = compare(scenario, instance, [("optimal", optimal), ("greedy", baseline)], config)
    a = simulate(scenario, instance, optimal, config)
    b = simulate(scenario, instance, baseline, config.model_copy(update={"seed": 99}))
    independent_variance = np.var(a.score - b.score, ddof=1)
    paired_variance = np.var(paired.plans[0].trials.score - paired.plans[1].trials.score, ddof=1)
    assert paired_variance < independent_variance


def test_differences_are_against_the_first_plan() -> None:
    scenario, instance, optimal, baseline = _setup()
    result = compare(
        scenario,
        instance,
        [("optimal", optimal), ("greedy", baseline)],
        SimulationConfig(trials=3000, seed=4),
    )
    difference = result.differences[0]
    assert difference.plan == "greedy"
    expected = result.plans[1].trials.score.mean() - result.plans[0].trials.score.mean()
    assert difference.mean == pytest.approx(expected)
    assert 0.0 <= difference.share_better <= 1.0
