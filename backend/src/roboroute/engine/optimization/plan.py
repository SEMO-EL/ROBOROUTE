"""Plans and their evaluation under the planning model.

A plan is a list of runs; each run is an ordered list of mission indices. ``evaluate`` is the
single definition of feasibility and timing that every solver (brute force, DP, greedy) is checked
against.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from roboroute.engine.optimization.instance import PlanningInstance

TOLERANCE = 1e-9


@dataclass(frozen=True)
class Step:
    kind: Literal["travel", "mission", "reset"]
    seconds: float
    from_node: int  # 0 = start/home, i + 1 = mission i
    to_node: int


@dataclass(frozen=True)
class Plan:
    runs: tuple[tuple[int, ...], ...]
    mask: int
    completion_time: float
    expected_score: float
    steps: tuple[Step, ...]

    def better_than(self, other: "Plan") -> bool:
        """Higher expected score first; equal scores → shorter completion time."""
        if self.expected_score > other.expected_score + TOLERANCE:
            return True
        if abs(self.expected_score - other.expected_score) <= TOLERANCE:
            return self.completion_time < other.completion_time - TOLERANCE
        return False


def evaluate(instance: PlanningInstance, runs: Sequence[Sequence[int]]) -> Plan | None:
    """Time and score of a plan, or None if it breaks any rule or the time budget."""
    if len(runs) > 1 and not instance.multi_run:
        return None
    tau = instance.tau
    steps: list[Step] = []
    mask = 0
    elapsed = 0.0
    current = 0
    mounted = 0
    for run_index, run in enumerate(runs):
        if not run:
            return None
        if run_index > 0:
            steps.append(Step("travel", float(tau[current, 0]), current, 0))
            steps.append(Step("reset", instance.reset_time, 0, 0))
            elapsed += float(tau[current, 0]) + instance.reset_time
            current = 0
            mounted = 0  # attachments can be changed in home
        for i in run:
            if not 0 <= i < instance.n or mask >> i & 1:
                return None
            if instance.requires_mask[i] & ~mask:
                return None
            if instance.excludes_mask[i] & mask or instance.after_mask[i] & mask:
                return None
            needs = instance.attachment[i]
            if needs:
                if mounted and mounted != needs:
                    return None
                mounted = needs
            leg = float(tau[current, i + 1])
            steps.append(Step("travel", leg, current, i + 1))
            steps.append(Step("mission", float(instance.duration[i]), i + 1, i + 1))
            elapsed += leg + float(instance.duration[i])
            mask |= 1 << i
            current = i + 1
    if instance.must_end_in_home and current != 0:
        steps.append(Step("travel", float(tau[current, 0]), current, 0))
        elapsed += float(tau[current, 0])
    if not math.isfinite(elapsed) or elapsed > instance.budget + TOLERANCE:
        return None
    return Plan(
        runs=tuple(tuple(run) for run in runs),
        mask=mask,
        completion_time=elapsed,
        expected_score=instance.expected_score(mask),
        steps=tuple(steps),
    )
