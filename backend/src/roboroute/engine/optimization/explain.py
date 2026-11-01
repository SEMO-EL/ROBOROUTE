"""Explanations computed from the optimisation itself — never generated text.

- **Time breakdown:** travel, mission and reset time of the chosen plan, and the slack left.
- **Counterfactuals:** for each candidate mission, the best expected score of any feasible plan
  that *includes* it (if it was left out) or *excludes* it (if it was chosen). Because the DP
  knows the least completion time of every subset, these are exact optima, not estimates.
- **Speed sensitivity:** the route geometry is re-timed with the robot's speeds scaled and the
  problem re-solved, showing whether a faster or slower robot changes the best plan.
"""

import dataclasses
import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from roboroute.engine.models import Scenario
from roboroute.engine.motion.timing import time_path
from roboroute.engine.optimization.dp import DPResult, solve
from roboroute.engine.optimization.instance import PlanningInstance
from roboroute.engine.optimization.plan import TOLERANCE
from roboroute.engine.travel.matrix import START, TravelMatrix, node_poses


@dataclass(frozen=True)
class MissionVerdict:
    mission: str
    selected: bool
    reason: str
    counterfactual_score: float | None
    delta: float | None


@dataclass(frozen=True)
class Explanation:
    budget: float
    completion_time: float
    slack: float
    travel_seconds: float
    mission_seconds: float
    reset_seconds: float
    expected_score: float
    verdicts: list[MissionVerdict]


def explain(instance: PlanningInstance, result: DPResult) -> Explanation:
    best = result.best
    feasible = result.feasible
    scores = np.where(feasible, result.scores, -math.inf)
    masks = np.arange(feasible.size)
    verdicts: list[MissionVerdict] = []
    for i, mission in enumerate(instance.ids):
        has = (masks >> i) & 1 == 1
        if best.mask >> i & 1:
            without = float(scores[~has].max()) if (~has).any() else -math.inf
            delta = without - best.expected_score
            if delta >= -TOLERANCE:
                reason = "Optional: an equally good plan exists without it."
            else:
                reason = (
                    f"Chosen: without it the best possible plan scores {without:.1f} expected "
                    f"points ({delta:+.1f})."
                )
            verdicts.append(MissionVerdict(mission, True, reason, without, delta))
            continue
        if not (has & feasible).any():
            # The DP keeps only states within the budget, so time and rules (requirements, order,
            # attachments) cannot be told apart here; missions that are impossible by rules alone
            # were already removed with their own reason.
            reason = (
                "Left out: no plan that includes it, together with the missions it needs, fits "
                f"in the {instance.budget:g} s budget and follows the mission rules."
            )
            verdicts.append(MissionVerdict(mission, False, reason, None, None))
            continue
        with_it = float(scores[has].max())
        delta = with_it - best.expected_score
        reason = (
            f"Left out: the best plan that includes it scores {with_it:.1f} expected points "
            f"instead of {best.expected_score:.1f} ({delta:+.1f}); its time is better spent "
            "elsewhere."
        )
        verdicts.append(MissionVerdict(mission, False, reason, with_it, delta))

    travel = sum(s.seconds for s in best.steps if s.kind == "travel")
    work = sum(s.seconds for s in best.steps if s.kind == "mission")
    reset = sum(s.seconds for s in best.steps if s.kind == "reset")
    return Explanation(
        budget=instance.budget,
        completion_time=best.completion_time,
        slack=instance.budget - best.completion_time,
        travel_seconds=travel,
        mission_seconds=work,
        reset_seconds=reset,
        expected_score=best.expected_score,
        verdicts=verdicts,
    )


@dataclass(frozen=True)
class SensitivityRow:
    factor: float
    best_score: float
    completion_time: float
    runs: list[list[str]]
    same_selection_as_baseline: bool


def retimed_tau(
    scenario: Scenario, matrix: TravelMatrix, instance: PlanningInstance, factor: float
) -> NDArray[np.float64]:
    """Travel times with linear and angular top speeds multiplied by ``factor``.

    Accelerations and mission durations are unchanged; measured legs keep their measured time.
    """
    robot = scenario.robot.model_copy(
        update={
            "linear": scenario.robot.linear.model_copy(
                update={"max_speed": scenario.robot.linear.max_speed * factor}
            ),
            "angular": scenario.robot.angular.model_copy(
                update={"max_speed": scenario.robot.angular.max_speed * factor}
            ),
        }
    )
    poses = node_poses(scenario)
    nodes = [START, *instance.ids]
    tau = np.zeros((len(nodes), len(nodes)))
    for a, source in enumerate(nodes):
        for b, target in enumerate(nodes):
            if a == b:
                continue
            leg = matrix.legs.get((source, target))
            if leg is None:
                tau[a, b] = math.inf
            elif leg.provenance == "measured" or not leg.points:
                tau[a, b] = leg.seconds
            else:
                end = None if target == START else poses[target].theta
                tau[a, b] = time_path(leg.points, poses[source].theta, end, robot).total
    return tau


def speed_sensitivity(
    scenario: Scenario,
    matrix: TravelMatrix,
    instance: PlanningInstance,
    factors: list[float],
) -> list[SensitivityRow]:
    baseline = solve(instance).best.mask
    rows = []
    for factor in factors:
        scaled = dataclasses.replace(instance, tau=retimed_tau(scenario, matrix, instance, factor))
        best = solve(scaled).best
        rows.append(
            SensitivityRow(
                factor=factor,
                best_score=best.expected_score,
                completion_time=best.completion_time,
                runs=[[instance.ids[i] for i in run] for run in best.runs],
                same_selection_as_baseline=best.mask == baseline,
            )
        )
    return rows
