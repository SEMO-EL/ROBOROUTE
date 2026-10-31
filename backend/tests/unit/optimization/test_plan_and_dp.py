import dataclasses

import pytest
from hypothesis import given, settings

from roboroute.engine.optimization.bruteforce import brute_force
from roboroute.engine.optimization.dp import MAX_EXACT_MISSIONS, TooManyMissionsError, solve
from roboroute.engine.optimization.instance import PlanningInstance
from roboroute.engine.optimization.plan import evaluate
from tests.strategies import planning_instances
from tests.unit.optimization.factory import simple_instance


def test_evaluate_sums_travel_and_durations() -> None:
    instance = simple_instance([10, 20], [3, 4], budget=100, travel=2)
    plan = evaluate(instance, [[0, 1]])
    assert plan is not None
    assert plan.completion_time == pytest.approx(2 + 3 + 2 + 4)
    assert plan.expected_score == pytest.approx(30)


def test_evaluate_rejects_over_budget_and_repeats() -> None:
    instance = simple_instance([10, 20], [3, 4], budget=8, travel=2)
    assert evaluate(instance, [[0, 1]]) is None
    assert evaluate(instance, [[0, 0]]) is None


def test_evaluate_rejects_runs_in_single_run_format() -> None:
    instance = simple_instance([10, 20], [3, 4], budget=100)
    assert evaluate(instance, [[0], [1]]) is None


def test_evaluate_enforces_requirements_and_attachments() -> None:
    instance = dataclasses.replace(
        simple_instance([10, 20], [3, 4], budget=100),
        requires_mask=[0, 0b01],
        attachment=[1, 2],
        attachments=["arm", "hook"],
        multi_run=True,
        reset_time=5.0,
    )
    assert evaluate(instance, [[1, 0]]) is None  # requirement order
    assert evaluate(instance, [[0, 1]]) is None  # needs an attachment change without going home
    plan = evaluate(instance, [[0], [1]])
    assert plan is not None
    assert plan.completion_time == pytest.approx(3 + 5 + 4)


def test_greedy_counterexample_is_solved_exactly() -> None:
    # Design doc §8.3: X = 10 pts / 10 s, Y = 90 pts / 95 s, budget 100 s.
    instance = simple_instance([10, 90], [10, 95], budget=100)
    result = solve(instance)
    assert result.best.runs == ((1,),)
    assert result.best.expected_score == pytest.approx(90)


def test_budget_too_small() -> None:
    result = solve(simple_instance([10, 90], [10, 95], budget=5))
    assert result.best.runs == ()
    assert result.best.expected_score == 0.0


def test_zero_and_certain_probabilities() -> None:
    zero = solve(simple_instance([10, 20], [1, 1], budget=100, probabilities=[0.0, 0.0]))
    assert zero.best.expected_score == 0.0
    certain = solve(simple_instance([10, 20], [1, 1], budget=100, probabilities=[1.0, 1.0]))
    assert certain.best.expected_score == pytest.approx(30.0)


def test_equal_scores_prefer_shorter_time() -> None:
    instance = simple_instance([50, 50], [30, 10], budget=35)
    result = solve(instance)
    assert result.best.runs == ((1,),)


def test_top_plans_are_distinct_and_ordered() -> None:
    result = solve(simple_instance([10, 20, 30], [5, 5, 5], budget=12, travel=1), top_k=4)
    masks = [plan.mask for plan in result.top]
    assert len(set(masks)) == len(masks)
    scores = [plan.expected_score for plan in result.top]
    assert scores == sorted(scores, reverse=True)


def test_too_many_missions_refused() -> None:
    n = MAX_EXACT_MISSIONS + 1
    with pytest.raises(TooManyMissionsError):
        solve(simple_instance([1] * n, [1] * n, budget=10))


@settings(max_examples=300, deadline=None)
@given(planning_instances(max_n=6))
def test_dp_matches_brute_force(instance: PlanningInstance) -> None:
    exact = brute_force(instance)
    result = solve(instance)
    assert result.best.expected_score == pytest.approx(exact.expected_score, abs=1e-9)
    assert result.best.completion_time == pytest.approx(exact.completion_time, abs=1e-6)
    assert evaluate(instance, result.best.runs) is not None


@settings(max_examples=100, deadline=None)
@given(planning_instances(max_n=5))
def test_dp_finds_every_feasible_set(instance: PlanningInstance) -> None:
    """For every subset, DP's least completion time is ≤ that of any plan brute force finds."""
    from itertools import permutations

    result = solve(instance)
    for size in range(1, instance.n + 1):
        for sequence in permutations(range(instance.n), size):
            plan = evaluate(instance, [list(sequence)])
            if plan is not None:
                assert result.feasible[plan.mask]
                assert result.completion_time[plan.mask] <= plan.completion_time + 1e-6


def test_dp_counts_the_states_it_reached() -> None:
    # Two missions, plenty of time: (∅, home), ({0}, 0), ({1}, 1), ({0,1}, 0), ({0,1}, 1).
    result = solve(simple_instance([10, 20], [3, 4], budget=100))
    assert result.state_space == 4 * 3 * 1
    assert result.states_reached == 5
    assert result.reachable_subsets == 4
    # Nothing fits: only the start state is ever reached.
    tight = solve(simple_instance([10, 20], [3, 4], budget=1))
    assert tight.states_reached == 1
    assert tight.reachable_subsets == 1
