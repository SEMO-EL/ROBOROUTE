"""Sampling from the duration distributions of the domain model."""

import math

import numpy as np
from numpy.typing import NDArray

from roboroute.engine.models import Distribution, Empirical, Fixed, LogNormal, Triangular

FloatArray = NDArray[np.float64]


def sample(dist: Distribution, rng: np.random.Generator, size: int) -> FloatArray:
    if isinstance(dist, Fixed):
        return np.full(size, dist.value, dtype=np.float64)
    if isinstance(dist, Triangular):
        if dist.low == dist.high:
            return np.full(size, dist.low, dtype=np.float64)
        return rng.triangular(dist.low, dist.mode, dist.high, size)
    if isinstance(dist, LogNormal):
        return dist.median * np.exp(math.log(dist.gsd) * rng.standard_normal(size))
    assert isinstance(dist, Empirical)
    return rng.choice(np.asarray(dist.samples, dtype=np.float64), size=size, replace=True)


def travel_factors(rng: np.random.Generator, cv: float, size: int) -> FloatArray:
    """Multiplicative noise on travel times: lognormal with mean 1 and coefficient of variation cv.

    For a lognormal with parameters (μ, σ): mean = exp(μ + σ²/2) and CV² = exp(σ²) − 1.
    Setting σ² = ln(1 + cv²) and μ = −σ²/2 gives mean 1 and the requested CV. A multiplicative
    model keeps travel times positive and makes long legs vary more than short ones.
    """
    if cv <= 0.0:
        return np.ones(size, dtype=np.float64)
    sigma2 = math.log1p(cv * cv)
    return rng.lognormal(mean=-sigma2 / 2.0, sigma=math.sqrt(sigma2), size=size)
