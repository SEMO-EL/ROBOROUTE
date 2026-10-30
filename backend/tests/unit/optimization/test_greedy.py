import pytest
from hypothesis import given, settings

from roboroute.engine.optimization.dp import solve
from roboroute.engine.optimization.greedy import greedy
from roboroute.engine.optimization.instance import PlanningInstance
from roboroute.engine.optimization.plan import evaluate
from tests.strategies import planning_instances
from tests.unit.optimization.factory import simple_instance


def test_greedy_takes_the_best_ratio_first() -> None:
    plan = greedy(simple_instance([10, 30, 5], [10, 10, 10], budget=25))
    assert plan.runs == ((1, 0),)


def test_greedy_falls_into_the_ratio_trap() -> None:
    # Design doc §8.3: greedy takes X (1.0 pt/s), then Y no longer fits: 10 points, optimum 90.
    plan = greedy(simple_instance([10, 90], [10, 95], budget=100))
    assert plan.expected_score == pytest.approx(10)


def test_greedy_skips_missions_worth_nothing() -> None:
    plan = greedy(simple_instance([0, 20], [1, 1], budget=100))
    assert plan.runs == ((1,),)


@settings(max_examples=300, deadline=None)
@given(planning_instances(max_n=6))
def test_greedy_is_feasible_and_never_beats_the_optimum(instance: PlanningInstance) -> None:
    plan = greedy(instance)
    assert evaluate(instance, plan.runs) is not None
    assert plan.expected_score <= solve(instance).best.expected_score + 1e-9
