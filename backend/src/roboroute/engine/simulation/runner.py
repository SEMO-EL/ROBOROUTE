"""Monte Carlo simulation of a fixed plan (design doc §9.1).

Each trial plays the plan once with random travel times, execution times and outcomes, under the
same contingency rules the planner assumes:

1. A mission whose "succeeded" requirement failed (or whose "attempted" requirement was never
   started) is skipped — the robot does not drive to it.
2. A failed attempt is retried, up to the mission's attempt limit.
3. Optionally, a mission is skipped when its planned duration no longer fits in the remaining time.
4. The buzzer is hard: a mission still in progress when time runs out scores nothing and incurs
   no failure penalty; anything already completed keeps its points.

The simulation is a sequential event trace — one robot, no concurrency — vectorised over trials:
every mission is processed once for all trials with NumPy arrays, using masks for the trials in
which it is skipped, interrupted or already decided.
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from roboroute.engine.models import (
    AllOfBonus,
    FailurePenalty,
    MissionPoints,
    Requires,
    Scenario,
)
from roboroute.engine.models.simulation import SimulationConfig
from roboroute.engine.optimization.instance import PlanningInstance
from roboroute.engine.optimization.plan import evaluate
from roboroute.engine.simulation.rng import Kind, stream
from roboroute.engine.simulation.sampling import sample, travel_factors
from roboroute.engine.travel.matrix import START

FloatArray = NDArray[np.float64]
BoolArray = NDArray[np.bool_]


class PlanError(ValueError):
    pass


@dataclass(frozen=True)
class SimulationTrials:
    missions: list[str]  # planned missions, in plan order
    score: FloatArray  # (trials,)
    completion_time: FloatArray  # (trials,) the budget if the buzzer interrupted the plan
    cut_off: BoolArray  # (trials,) the buzzer interrupted travel or a mission
    skipped_for_time: BoolArray  # (trials,) some mission was skipped because time ran short
    started: BoolArray  # (trials, missions)
    succeeded: BoolArray  # (trials, missions)
    failed: BoolArray  # (trials, missions) every allowed attempt finished and failed

    @property
    def attempted(self) -> BoolArray:
        return self.started


def _indices(instance: PlanningInstance, runs: list[list[str]]) -> list[list[int]]:
    position = {mission: i for i, mission in enumerate(instance.ids)}
    result = []
    for run in runs:
        indices = []
        for mission in run:
            if mission not in position:
                raise PlanError(
                    f"The plan contains '{mission}', which is not a plannable mission of this "
                    "scenario."
                )
            indices.append(position[mission])
        result.append(indices)
    if evaluate(instance, result, enforce_budget=False) is None:
        raise PlanError(
            "The plan breaks a rule: requirement or order constraint, exclusion, repeated "
            "mission, attachment change outside home, or several runs in a single-run format."
        )
    return result


def simulate(
    scenario: Scenario,
    instance: PlanningInstance,
    runs: list[list[str]],
    config: SimulationConfig,
) -> SimulationTrials:
    plan = _indices(instance, runs)
    trials = config.trials
    budget = instance.budget
    tau = instance.tau
    names = [START, *instance.ids]
    order = [i for run in plan for i in run]
    column = {mission: c for c, mission in enumerate(order)}

    requirements: dict[int, list[tuple[int, str]]] = {i: [] for i in order}
    index = {mission: i for i, mission in enumerate(instance.ids)}
    for constraint in scenario.constraints:
        if isinstance(constraint, Requires) and constraint.after in index:
            after = index[constraint.after]
            if after in requirements and constraint.before in index:
                requirements[after].append((index[constraint.before], constraint.semantics))

    elapsed = np.zeros(trials)
    active = np.ones(trials, dtype=bool)
    cut_off = np.zeros(trials, dtype=bool)
    skipped = np.zeros(trials, dtype=bool)
    position = np.zeros(trials, dtype=np.int64)
    started = np.zeros((trials, len(order)), dtype=bool)
    succeeded = np.zeros((trials, len(order)), dtype=bool)
    failed = np.zeros((trials, len(order)), dtype=bool)

    factor_cache: dict[tuple[int, int], FloatArray] = {}

    def factors(a: int, b: int) -> FloatArray:
        if (a, b) not in factor_cache:
            key = f"{names[a]}->{names[b]}"
            factor_cache[(a, b)] = travel_factors(
                stream(config.seed, key, Kind.TRAVEL), config.travel_time_cv, trials
            )
        return factor_cache[(a, b)]

    def travel_time(moving: BoolArray, target: int) -> FloatArray:
        legs = np.zeros(trials)
        for origin in np.unique(position[moving]):
            selected = moving & (position == origin)
            legs[selected] = tau[origin, target] * factors(int(origin), target)[selected]
        return legs

    def stop(late: BoolArray) -> None:
        cut_off[late] = True
        active[late] = False
        elapsed[late] = budget

    def move(moving: BoolArray, target: int) -> BoolArray:
        arrive = elapsed + travel_time(moving, target)
        late = moving & (arrive > budget)
        stop(late)
        arrived = moving & ~late
        elapsed[arrived] = arrive[arrived]
        position[arrived] = target
        return arrived

    for run_number, run in enumerate(plan):
        if run_number > 0:
            home = move(active & (position != 0), 0)
            elapsed[home] += instance.reset_time
            stop(home & (elapsed > budget))
        for i in run:
            col = column[i]
            mission = scenario.mission(instance.ids[i])
            eligible = active.copy()
            for required, semantics in requirements[i]:
                done = succeeded if semantics == "succeeded" else started
                eligible &= done[:, column[required]]
            if config.skip_if_insufficient_time:
                nominal = tau[position, i + 1] + instance.duration[i]
                if instance.must_end_in_home:
                    nominal = nominal + tau[i + 1, 0]
                no_time = eligible & (elapsed + nominal > budget + 1e-9)
                skipped |= no_time
                eligible &= ~no_time

            arrived = move(eligible, i + 1)
            started[:, col] = arrived

            attempts = mission.max_attempts
            first = sample(
                mission.execution_time, stream(config.seed, mission.id, Kind.EXECUTION), trials
            )
            retry_dist = mission.retry_time or mission.execution_time
            retries = sample(
                retry_dist, stream(config.seed, mission.id, Kind.RETRY), trials * (attempts - 1)
            ).reshape(trials, attempts - 1)
            p = mission.success.point_estimate()
            wins = stream(config.seed, mission.id, Kind.SUCCESS).random((trials, attempts)) < p

            trying = arrived.copy()
            for attempt in range(attempts):
                duration = first if attempt == 0 else retries[:, attempt - 1]
                finish = elapsed + duration
                late = trying & (finish > budget)
                stop(late)
                trying &= ~late
                elapsed[trying] = finish[trying]
                won = trying & wins[:, attempt]
                succeeded[:, col] |= won
                trying &= ~won
            failed[:, col] = trying

    if instance.must_end_in_home:
        move(active & (position != 0), 0)

    score = np.zeros(trials)
    for rule in scenario.scoring.rules:
        if (
            isinstance(rule, MissionPoints)
            and rule.mission in index
            and index[rule.mission] in column
        ):
            score += rule.points * succeeded[:, column[index[rule.mission]]]
        elif (
            isinstance(rule, FailurePenalty)
            and rule.mission in index
            and index[rule.mission] in column
        ):
            score -= rule.points * failed[:, column[index[rule.mission]]]
        elif isinstance(rule, AllOfBonus) and all(
            m in index and index[m] in column for m in rule.missions
        ):
            cols = [column[index[m]] for m in rule.missions]
            score += rule.points * succeeded[:, cols].all(axis=1)

    return SimulationTrials(
        missions=[instance.ids[i] for i in order],
        score=score,
        completion_time=elapsed,
        cut_off=cut_off,
        skipped_for_time=skipped,
        started=started,
        succeeded=succeeded,
        failed=failed,
    )
