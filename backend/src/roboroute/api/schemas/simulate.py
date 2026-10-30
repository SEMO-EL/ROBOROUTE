"""API models for Monte Carlo simulation."""

from pydantic import BaseModel, Field

from roboroute.engine.models import Scenario
from roboroute.engine.models.base import Identifier
from roboroute.engine.models.simulation import SimulationConfig
from roboroute.engine.stats.summary import Interval, Summary


class PlanSpec(BaseModel):
    model_config = {"extra": "forbid"}

    label: str = Field(min_length=1, max_length=60)
    runs: list[list[Identifier]] = Field(max_length=20)


class SimulateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    scenario: Scenario
    plans: list[PlanSpec] = Field(min_length=1, max_length=3)
    config: SimulationConfig = SimulationConfig()


class IntervalOut(BaseModel):
    low: float
    high: float

    @classmethod
    def of(cls, interval: Interval) -> "IntervalOut":
        return cls(low=interval.low, high=interval.high)


class QuantileOut(BaseModel):
    q: float
    estimate: float
    interval: IntervalOut


class SummaryOut(BaseModel):
    n: int
    mean: float
    mean_ci: IntervalOut
    std: float
    minimum: float
    maximum: float
    quantiles: dict[str, QuantileOut]

    @classmethod
    def of(cls, summary: Summary) -> "SummaryOut":
        return cls(
            n=summary.n,
            mean=summary.mean,
            mean_ci=IntervalOut.of(summary.mean_ci),
            std=summary.std,
            minimum=summary.minimum,
            maximum=summary.maximum,
            quantiles={
                name: QuantileOut(q=q.q, estimate=q.estimate, interval=IntervalOut.of(q.interval))
                for name, q in summary.quantiles.items()
            },
        )


class ProbabilityOut(BaseModel):
    estimate: float
    interval: IntervalOut


class HistogramOut(BaseModel):
    edges: list[float]
    counts: list[int]


class MissionRateOut(BaseModel):
    mission: str
    started: ProbabilityOut
    succeeded: ProbabilityOut


class PlanSimulationOut(BaseModel):
    label: str
    runs: list[list[str]]
    score: SummaryOut
    completion_time: SummaryOut
    probability_cut_off: ProbabilityOut
    probability_skipped_for_time: ProbabilityOut
    probability_target: ProbabilityOut | None
    score_histogram: HistogramOut
    completion_histogram: HistogramOut
    score_ecdf: list[tuple[float, float]]
    missions: list[MissionRateOut]
    analytic_expected_score: float = Field(
        description="Expected score of this plan under the deterministic planning model"
    )
    planned_time: float = Field(description="Completion time under the planning model (s)")


class DifferenceOut(BaseModel):
    plan: str
    reference: str
    mean: float
    interval: IntervalOut
    share_better: float
    share_worse: float


class SimulationMetadata(BaseModel):
    engine_version: str
    numpy_version: str
    seed: int
    trials: int
    input_hash: str = Field(
        description="SHA-256 of the canonical request (scenario, plans, config)"
    )


class SimulateResponse(BaseModel):
    plans: list[PlanSimulationOut]
    differences: list[DifferenceOut]
    metadata: SimulationMetadata
    assumptions: list[str]
    compute_seconds: float
