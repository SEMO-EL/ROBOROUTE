"""Settings for Monte Carlo simulation (design doc §9)."""

from pydantic import Field

from roboroute.engine.models.base import StrictModel

MAX_TRIALS = 50_000


class SimulationConfig(StrictModel):
    trials: int = Field(default=10_000, ge=1, le=MAX_TRIALS)
    seed: int = Field(default=0, ge=0, le=2**32 - 1)
    travel_time_cv: float = Field(
        default=0.10,
        ge=0.0,
        le=1.0,
        description="Coefficient of variation of each travel leg's time (0 = no travel noise)",
    )
    skip_if_insufficient_time: bool = Field(
        default=True,
        description="Skip a mission when its planned duration no longer fits in the remaining time",
    )
    target_score: float | None = Field(default=None, ge=0.0, le=100_000.0)
