import math

import numpy as np
import pytest
from numpy.typing import NDArray

from roboroute.engine.models import Empirical, Fixed, LogNormal, Triangular
from roboroute.engine.simulation.rng import Kind, stream
from roboroute.engine.simulation.sampling import sample, travel_factors

N = 200_000


def within_standard_errors(values: NDArray[np.float64], expected: float, k: float = 5.0) -> bool:
    """|mean − expected| ≤ k standard errors: a tolerance derived from the variance, not tuned."""
    se = values.std(ddof=1) / math.sqrt(values.size)
    return bool(abs(values.mean() - expected) <= k * se + 1e-12)


@pytest.mark.parametrize(
    "dist",
    [
        Triangular(low=4, mode=6, high=11),
        LogNormal(median=5, gsd=1.4),
        Empirical(samples=[3.0, 4.5, 9.0]),
    ],
)
def test_sample_mean_matches_model_mean(dist: Triangular | LogNormal | Empirical) -> None:
    values = sample(dist, stream(1, "m", Kind.EXECUTION), N)
    assert within_standard_errors(values, dist.mean())
    assert values.min() >= 0.0


def test_fixed_is_exact() -> None:
    assert np.all(sample(Fixed(value=4.2), stream(1, "m", Kind.EXECUTION), 10) == 4.2)


def test_degenerate_triangular() -> None:
    values = sample(Triangular(low=5, mode=5, high=5), stream(1, "m", Kind.EXECUTION), 10)
    assert np.all(values == 5.0)


def test_travel_factors_have_mean_one_and_requested_cv() -> None:
    factors = travel_factors(stream(3, "a->b", Kind.TRAVEL), 0.15, N)
    assert within_standard_errors(factors, 1.0)
    assert factors.std() / factors.mean() == pytest.approx(0.15, rel=0.02)


def test_zero_cv_means_no_noise() -> None:
    assert np.all(travel_factors(stream(3, "a->b", Kind.TRAVEL), 0.0, 5) == 1.0)


def test_streams_are_reproducible_and_keyed() -> None:
    a = stream(42, "bridge", Kind.SUCCESS).random(5)
    b = stream(42, "bridge", Kind.SUCCESS).random(5)
    c = stream(42, "crane", Kind.SUCCESS).random(5)
    d = stream(43, "bridge", Kind.SUCCESS).random(5)
    e = stream(42, "bridge", Kind.EXECUTION).random(5)
    np.testing.assert_array_equal(a, b)
    for other in (c, d, e):
        assert not np.array_equal(a, other)
