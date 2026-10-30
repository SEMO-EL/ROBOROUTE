"""Calibration data: measurements a team takes with a ruler and a stopwatch (design doc §6.2)."""

from typing import Literal

from pydantic import Field

from roboroute.engine.models.base import StrictModel


class Measurement(StrictModel):
    """One timed movement: ``amount`` metres (driving) or radians (turning) in ``seconds``."""

    amount: float = Field(gt=0.0, le=50.0)
    seconds: float = Field(gt=0.0, le=120.0)


class CalibrationRequest(StrictModel):
    kind: Literal["linear", "angular"]
    measurements: list[Measurement] = Field(min_length=1, max_length=50)


class CalibrationResult(StrictModel):
    max_speed: float
    acceleration: float | None
    model: Literal["constant_speed", "trapezoidal"]
    method: Literal[
        "average_speed", "proportional_fit", "linear_least_squares", "nonlinear_least_squares"
    ]
    r_squared: float | None
    residuals: list[float]
    warnings: list[str]
