"""Settings for strategy optimisation."""

from pydantic import Field

from roboroute.engine.models.base import StrictModel


class PlanningSettings(StrictModel):
    top_k: int = Field(default=5, ge=1, le=20, description="How many alternative plans to return")
    sensitivity_factors: list[float] = Field(
        default_factory=lambda: [0.8, 0.9, 1.1, 1.2],
        max_length=8,
        description="Robot speed multipliers for the sensitivity analysis",
    )
