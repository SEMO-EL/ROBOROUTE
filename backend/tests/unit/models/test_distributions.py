import math

import pytest
from pydantic import TypeAdapter, ValidationError

from roboroute.engine.models import Distribution, Empirical, Fixed, LogNormal, Triangular

adapter: TypeAdapter[Distribution] = TypeAdapter(Distribution)


def test_fixed_mean() -> None:
    assert Fixed(value=4.0).mean() == 4.0


def test_triangular_mean_is_average_of_parameters() -> None:
    assert Triangular(low=4.0, mode=6.0, high=11.0).mean() == pytest.approx(7.0)


def test_triangular_mode_outside_range_rejected() -> None:
    with pytest.raises(ValidationError, match="low ≤ mode ≤ high"):
        Triangular(low=4.0, mode=12.0, high=11.0)


def test_lognormal_mean_exceeds_median() -> None:
    # mean = median · exp(σ²/2) with σ = ln(gsd)
    dist = LogNormal(median=5.0, gsd=1.5)
    assert dist.mean() == pytest.approx(5.0 * math.exp(math.log(1.5) ** 2 / 2))


def test_lognormal_gsd_below_one_rejected() -> None:
    with pytest.raises(ValidationError):
        LogNormal(median=5.0, gsd=0.9)


def test_empirical_mean() -> None:
    assert Empirical(samples=[1.0, 2.0, 6.0]).mean() == pytest.approx(3.0)


def test_empirical_requires_samples() -> None:
    with pytest.raises(ValidationError):
        Empirical(samples=[])


def test_negative_durations_rejected() -> None:
    with pytest.raises(ValidationError):
        Fixed(value=-1.0)


def test_discriminated_union_parses_by_kind() -> None:
    parsed = adapter.validate_python({"kind": "triangular", "low": 1, "mode": 2, "high": 3})
    assert isinstance(parsed, Triangular)
