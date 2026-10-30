"""API models for strategy optimisation."""

from typing import Literal

from pydantic import BaseModel

from roboroute.api.schemas.routes import PointOut
from roboroute.engine.models import Issue, Scenario
from roboroute.engine.models.planning import PlanningSettings
from roboroute.engine.optimization.explain import Explanation, SensitivityRow
from roboroute.engine.optimization.instance import PlanningInstance
from roboroute.engine.optimization.plan import Plan
from roboroute.engine.travel.matrix import START, TravelMatrix


class OptimizeRequest(BaseModel):
    model_config = {"extra": "forbid"}

    scenario: Scenario
    settings: PlanningSettings = PlanningSettings()


class StepOut(BaseModel):
    kind: Literal["travel", "mission", "reset"]
    from_node: str
    to_node: str
    seconds: float
    provenance: Literal["modeled", "measured", "planned"]


class PlanOut(BaseModel):
    runs: list[list[str]]
    expected_score: float
    completion_time: float
    steps: list[StepOut]
    route: list[list[PointOut]]

    @classmethod
    def of(cls, plan: Plan, instance: PlanningInstance, matrix: TravelMatrix) -> "PlanOut":
        names = [START, *instance.ids]
        steps: list[StepOut] = []
        route: list[list[PointOut]] = []
        for step in plan.steps:
            source, target = names[step.from_node], names[step.to_node]
            provenance: Literal["modeled", "measured", "planned"] = "planned"
            if step.kind == "travel":
                leg = matrix.legs.get((source, target))
                provenance = leg.provenance if leg else "modeled"
                route.append(list(leg.points) if leg else [])
            steps.append(
                StepOut(
                    kind=step.kind,
                    from_node=source,
                    to_node=target,
                    seconds=step.seconds,
                    provenance=provenance,
                )
            )
        return cls(
            runs=[[instance.ids[i] for i in run] for run in plan.runs],
            expected_score=plan.expected_score,
            completion_time=plan.completion_time,
            steps=steps,
            route=route,
        )


class VerdictOut(BaseModel):
    mission: str
    selected: bool
    reason: str
    counterfactual_score: float | None
    delta: float | None


class ExplanationOut(BaseModel):
    budget: float
    completion_time: float
    slack: float
    travel_seconds: float
    mission_seconds: float
    reset_seconds: float
    expected_score: float
    verdicts: list[VerdictOut]

    @classmethod
    def of(cls, explanation: Explanation) -> "ExplanationOut":
        return cls(
            budget=explanation.budget,
            completion_time=explanation.completion_time,
            slack=explanation.slack,
            travel_seconds=explanation.travel_seconds,
            mission_seconds=explanation.mission_seconds,
            reset_seconds=explanation.reset_seconds,
            expected_score=explanation.expected_score,
            verdicts=[
                VerdictOut(
                    mission=v.mission,
                    selected=v.selected,
                    reason=v.reason,
                    counterfactual_score=v.counterfactual_score,
                    delta=v.delta,
                )
                for v in explanation.verdicts
            ],
        )


class SensitivityOut(BaseModel):
    factor: float
    best_score: float
    completion_time: float
    runs: list[list[str]]
    same_selection_as_baseline: bool

    @classmethod
    def of(cls, row: SensitivityRow) -> "SensitivityOut":
        return cls(
            factor=row.factor,
            best_score=row.best_score,
            completion_time=row.completion_time,
            runs=row.runs,
            same_selection_as_baseline=row.same_selection_as_baseline,
        )


class ExcludedOut(BaseModel):
    mission: str
    reason: str


class OptimizeResponse(BaseModel):
    candidates: list[str]
    excluded: list[ExcludedOut]
    warnings: list[Issue]
    optimal: PlanOut | None
    alternatives: list[PlanOut]
    greedy: PlanOut
    explanation: ExplanationOut | None
    sensitivity: list[SensitivityOut]
    assumptions: list[str]
    compute_seconds: float
