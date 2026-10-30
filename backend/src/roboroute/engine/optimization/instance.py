"""Compile a scenario and its travel matrix into the planning model of design doc §8.1.

The planning model is deterministic: every mission takes its *planning duration* (the mean of
its execution-time distribution; with retries, every attempt is budgeted so that a plan stays
feasible however many attempts are needed) and succeeds eventually with probability
P = 1 − (1 − p)^m for m attempts of per-attempt probability p. Outcomes are independent.

Missions that can never be part of a plan are removed up front, each with a reason:
contradictory constraints, unreachable approach pose, requiring a removed mission, or not
fitting in the time budget even on their own.

Mission i ↔ bit i of a mask ↔ node i + 1 of ``tau`` (node 0 is the start / home).
"""

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from roboroute.engine.missions.validation import impossible_missions, validate_constraints
from roboroute.engine.models import (
    AllOfBonus,
    FailurePenalty,
    Issue,
    MissionPoints,
    Precedes,
    Requires,
    Scenario,
)
from roboroute.engine.travel.matrix import START, TravelMatrix

FloatArray = NDArray[np.float64]


class PlanningError(ValueError):
    def __init__(self, issues: list[Issue]) -> None:
        super().__init__("; ".join(issue.message for issue in issues))
        self.issues = issues


@dataclass(frozen=True)
class PlanningInstance:
    ids: list[str]
    names: list[str]
    tau: FloatArray  # (n+1) × (n+1) travel seconds, inf if no route
    duration: FloatArray  # planning duration per mission (s)
    p_eventual: FloatArray  # probability that the mission eventually succeeds
    requires_mask: list[int]  # missions that must already be done before mission i
    after_mask: list[int]  # missions that must come after i: i is forbidden once any is done
    excludes_mask: list[int]
    attachment: list[int]  # 0 = none, k ≥ 1 = attachments[k - 1]
    attachments: list[str]
    budget: float
    multi_run: bool
    reset_time: float
    must_end_in_home: bool
    weight: FloatArray  # expected points of each mission's own rules when it is in the plan
    bonuses: list[tuple[int, float]]  # (mask that must be complete, expected bonus)
    excluded: dict[str, str] = field(default_factory=dict)

    @property
    def n(self) -> int:
        return len(self.ids)

    def expected_score(self, mask: int) -> float:
        total = sum(float(self.weight[i]) for i in range(self.n) if mask >> i & 1)
        total += sum(value for need, value in self.bonuses if mask & need == need)
        return total

    def expected_scores(self) -> FloatArray:
        """Expected score of every subset at once (index = mask), vectorised."""
        masks = np.arange(1 << self.n, dtype=np.int64)
        scores = np.zeros(1 << self.n, dtype=np.float64)
        for i in range(self.n):
            scores += ((masks >> i) & 1) * self.weight[i]
        for need, value in self.bonuses:
            scores += ((masks & need) == need) * value
        return scores


def _remove_dependents(scenario: Scenario, excluded: dict[str, str]) -> None:
    """Exclude, until nothing changes, every mission that requires an excluded mission."""
    changed = True
    while changed:
        changed = False
        for c in scenario.constraints:
            if isinstance(c, Requires) and c.before in excluded and c.after not in excluded:
                excluded[c.after] = (
                    f"Mission '{c.after}' requires '{c.before}', which cannot be done."
                )
                changed = True


def compile_instance(scenario: Scenario, matrix: TravelMatrix) -> PlanningInstance:
    issues = [i for i in validate_constraints(scenario) if i.severity == "error"]
    if issues:
        raise PlanningError(issues)

    fmt = scenario.format
    budget = fmt.time_budget
    excluded: dict[str, str] = dict(impossible_missions(scenario))
    for mission in scenario.missions:
        failure = matrix.failures.get((START, mission.id))
        if failure is not None and mission.id not in excluded:
            excluded[mission.id] = failure.message
    _remove_dependents(scenario, excluded)

    def planning_duration(mission_id: str) -> float:
        m = scenario.mission(mission_id)
        retry = m.retry_time.mean() if m.retry_time is not None else m.execution_time.mean()
        return m.execution_time.mean() + (m.max_attempts - 1) * retry

    for mission in scenario.missions:
        if mission.id in excluded:
            continue
        alone = matrix.seconds(START, mission.id) + planning_duration(mission.id)
        if fmt.must_end_in_home:
            alone += matrix.seconds(mission.id, START)
        if alone > budget:
            excluded[mission.id] = (
                f"Mission '{mission.id}' needs {alone:.1f} s even on its own, more than the "
                f"{budget:g} s time budget."
            )
    _remove_dependents(scenario, excluded)

    ids = [m.id for m in scenario.missions if m.id not in excluded]
    index = {mission_id: i for i, mission_id in enumerate(ids)}
    nodes = [START, *ids]
    tau = np.array([[matrix.seconds(a, b) for b in nodes] for a in nodes], dtype=np.float64)

    p_eventual = np.array(
        [
            1.0
            - (1.0 - scenario.mission(i).success.point_estimate())
            ** scenario.mission(i).max_attempts
            for i in ids
        ]
    )

    requires_mask = [0] * len(ids)
    after_mask = [0] * len(ids)
    excludes_mask = [0] * len(ids)
    success_needed: dict[str, list[str]] = {i: [] for i in ids}  # direct "succeeded" requirements
    attempt_needed: dict[str, list[str]] = {i: [] for i in ids}  # direct "attempted" requirements
    for c in scenario.constraints:
        if isinstance(c, Requires | Precedes):
            if c.before in index and c.after in index:
                after_mask[index[c.before]] |= 1 << index[c.after]
            if isinstance(c, Requires) and c.after in index:
                requires_mask[index[c.after]] |= 1 << index[c.before]
                needed = success_needed if c.semantics == "succeeded" else attempt_needed
                needed[c.after].append(c.before)
        elif c.a in index and c.b in index:
            excludes_mask[index[c.a]] |= 1 << index[c.b]
            excludes_mask[index[c.b]] |= 1 << index[c.a]

    # Need(i): missions whose success is necessary for i to be attempted (the robot skips a
    # mission whose "succeeded" requirement failed). Shared ancestors are counted once, which is
    # exactly right for independent events.
    need_cache: dict[str, frozenset[str]] = {}

    def need(mission_id: str) -> frozenset[str]:
        if mission_id not in need_cache:
            result: set[str] = set()
            for r in success_needed[mission_id]:
                result |= need(r) | {r}
            for r in attempt_needed[mission_id]:
                result |= need(r)
            need_cache[mission_id] = frozenset(result)
        return need_cache[mission_id]

    def prob(missions: frozenset[str] | set[str]) -> float:
        return float(np.prod([p_eventual[index[m]] for m in missions])) if missions else 1.0

    weight = np.zeros(len(ids), dtype=np.float64)
    bonuses: list[tuple[int, float]] = []
    for rule in scenario.scoring.rules:
        if isinstance(rule, MissionPoints) and rule.mission in index:
            weight[index[rule.mission]] += rule.points * prob(need(rule.mission) | {rule.mission})
        elif isinstance(rule, FailurePenalty) and rule.mission in index:
            i = index[rule.mission]
            weight[i] -= rule.points * prob(need(rule.mission)) * (1.0 - p_eventual[i])
        elif isinstance(rule, AllOfBonus) and all(m in index for m in rule.missions):
            mask = sum(1 << index[m] for m in rule.missions)
            required: set[str] = set()
            for m in rule.missions:
                required |= need(m) | {m}
            bonuses.append((mask, rule.points * prob(required)))

    attachment_names = sorted({a for i in ids if (a := scenario.mission(i).attachment) is not None})
    attachment = [
        0 if (a := scenario.mission(i).attachment) is None else attachment_names.index(a) + 1
        for i in ids
    ]

    return PlanningInstance(
        ids=ids,
        names=[scenario.mission(i).name for i in ids],
        tau=tau,
        duration=np.array([planning_duration(i) for i in ids], dtype=np.float64),
        p_eventual=p_eventual,
        requires_mask=requires_mask,
        after_mask=after_mask,
        excludes_mask=excludes_mask,
        attachment=attachment,
        attachments=attachment_names,
        budget=budget,
        multi_run=fmt.kind == "multi_run",
        reset_time=fmt.reset_time,
        must_end_in_home=fmt.must_end_in_home,
        weight=weight,
        bonuses=bonuses,
        excluded=excluded,
    )
