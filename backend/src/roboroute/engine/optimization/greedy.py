"""Greedy baseline: repeatedly add the mission with the best expected points per second.

    ratio(k) = (E[S ∪ {k}] − E[S]) / Δt(k)

where Δt(k) is the travel plus planning duration of k (plus a trip home and the reset time if k
needs a different attachment). Missions that would break the time budget or a constraint are
skipped. Fast — O(n²) evaluations — but not optimal: a high-ratio mission taken early can use
up time that a more valuable mission needed (design doc §8.3). RoboRoute uses it as a baseline
to show how much the exact optimisation gains.
"""

import math

from roboroute.engine.optimization.instance import PlanningInstance
from roboroute.engine.optimization.plan import TOLERANCE, Plan, evaluate


def greedy(instance: PlanningInstance) -> Plan:
    tau = instance.tau
    runs: list[list[int]] = [[]]
    mask = 0
    elapsed = 0.0
    current = 0
    mounted = 0
    score = instance.expected_score(0)

    while True:
        choice: tuple[float, int, float, bool] | None = None  # (ratio, k, dt, new run)
        for k in range(instance.n):
            if mask >> k & 1 or instance.requires_mask[k] & ~mask:
                continue
            if instance.excludes_mask[k] & mask or instance.after_mask[k] & mask:
                continue
            needs = instance.attachment[k]
            change = bool(needs and mounted and needs != mounted)
            if change and not instance.multi_run:
                continue
            if change:
                dt = float(tau[current, 0] + instance.reset_time + tau[0, k + 1])
            else:
                dt = float(tau[current, k + 1])
            dt += float(instance.duration[k])
            end = float(tau[k + 1, 0]) if instance.must_end_in_home else 0.0
            if not math.isfinite(dt) or elapsed + dt + end > instance.budget + TOLERANCE:
                continue
            gain = instance.expected_score(mask | 1 << k) - score
            if gain <= TOLERANCE:
                continue
            ratio = gain / dt if dt > 0 else math.inf
            if choice is None or ratio > choice[0]:
                choice = (ratio, k, dt, change)
        if choice is None:
            break
        _, k, dt, new_run = choice
        if new_run:
            runs.append([])
            mounted = 0
        runs[-1].append(k)
        mounted = instance.attachment[k] or mounted
        mask |= 1 << k
        elapsed += dt
        current = k + 1
        score = instance.expected_score(mask)

    plan = evaluate(instance, [run for run in runs if run])
    if plan is None:  # pragma: no cover - the loop only ever adds feasible steps
        raise AssertionError("greedy produced an infeasible plan")
    return plan
