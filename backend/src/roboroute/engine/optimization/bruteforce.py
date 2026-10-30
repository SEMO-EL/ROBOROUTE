"""Exhaustive search over every plan — the independent correctness oracle for small instances.

Every ordered selection of missions (n!/(n−k)! for each size k) and, in multi-run formats, every
way of splitting it into runs (2^(k−1)) is evaluated with ``evaluate``. Exponential and slow on
purpose: it shares no logic with the DP except the plan evaluation itself.
"""

from itertools import permutations, product

from roboroute.engine.optimization.instance import PlanningInstance
from roboroute.engine.optimization.plan import Plan, evaluate

MAX_BRUTE_FORCE = 8


def _splits(sequence: tuple[int, ...], multi_run: bool) -> list[list[list[int]]]:
    if not multi_run or len(sequence) <= 1:
        return [[list(sequence)]]
    result = []
    for cuts in product((False, True), repeat=len(sequence) - 1):
        runs = [[sequence[0]]]
        for mission, cut in zip(sequence[1:], cuts, strict=True):
            if cut:
                runs.append([mission])
            else:
                runs[-1].append(mission)
        result.append(runs)
    return result


def brute_force(instance: PlanningInstance) -> Plan:
    if instance.n > MAX_BRUTE_FORCE:
        raise ValueError(f"brute force is limited to {MAX_BRUTE_FORCE} missions")
    best = evaluate(instance, [])
    assert best is not None  # the empty plan is always feasible
    for size in range(1, instance.n + 1):
        for sequence in permutations(range(instance.n), size):
            for runs in _splits(sequence, instance.multi_run):
                plan = evaluate(instance, runs)
                if plan is not None and plan.better_than(best):
                    best = plan
    return best
