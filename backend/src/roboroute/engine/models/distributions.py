"""Probability distributions for durations (design doc §9.2).

All distributions are supported on [0, ∞): durations can never be negative. Normal distributions
are deliberately not offered as a default because they put probability on negative times.
"""

import math
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from roboroute.engine.models.base import Duration, StrictModel


class Fixed(StrictModel):
    kind: Literal["fixed"] = "fixed"
    value: Duration

    def mean(self) -> float:
        return self.value


class Triangular(StrictModel):
    """Best case / most likely / worst case — the easiest estimate for a team to give."""

    kind: Literal["triangular"] = "triangular"
    low: Duration
    mode: Duration
    high: Duration

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if not self.low <= self.mode <= self.high:
            raise ValueError("triangular distribution needs low ≤ mode ≤ high")
        return self

    def mean(self) -> float:
        return (self.low + self.mode + self.high) / 3.0


class LogNormal(StrictModel):
    """Right-skewed, strictly positive. Parameterised by median and geometric std. deviation.

    If ``X = median · exp(σ Z)`` with ``Z ~ N(0, 1)`` and ``σ = ln(gsd)``, then
    ``E[X] = median · exp(σ² / 2)``.
    """

    kind: Literal["lognormal"] = "lognormal"
    median: float = Field(gt=0.0, le=600.0)
    gsd: float = Field(ge=1.0, le=10.0)

    def mean(self) -> float:
        sigma = math.log(self.gsd)
        return self.median * math.exp(sigma * sigma / 2.0)


class Empirical(StrictModel):
    """Resample from measured values (e.g. stopwatch times from practice)."""

    kind: Literal["empirical"] = "empirical"
    samples: list[Duration] = Field(min_length=1, max_length=10_000)

    def mean(self) -> float:
        return math.fsum(self.samples) / len(self.samples)


Distribution = Annotated[Fixed | Triangular | LogNormal | Empirical, Field(discriminator="kind")]
