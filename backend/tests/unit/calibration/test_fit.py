import math

import pytest

from roboroute.engine.calibration.fit import fit_profile
from roboroute.engine.models import MotionProfile
from roboroute.engine.models.calibration import Measurement
from roboroute.engine.motion.profiles import profile_time


def exact(v: float, a: float, amounts: list[float]) -> list[Measurement]:
    profile = MotionProfile(max_speed=v, acceleration=a)
    return [Measurement(amount=d, seconds=profile_time(d, profile)) for d in amounts]


def test_recovers_known_parameters_in_trapezoid_regime() -> None:
    result = fit_profile(exact(0.4, 0.8, [0.5, 1.0, 1.5]))
    assert result.model == "trapezoidal"
    assert result.method == "linear_least_squares"
    assert result.max_speed == pytest.approx(0.4)
    assert result.acceleration == pytest.approx(0.8)
    assert result.r_squared == pytest.approx(1.0)


def test_design_document_example() -> None:
    # 20 cm in 1.2 s and 100 cm in 3.6 s → v = 0.333 m/s, a = 0.556 m/s².
    result = fit_profile(
        [Measurement(amount=0.2, seconds=1.2), Measurement(amount=1.0, seconds=3.6)]
    )
    assert result.max_speed == pytest.approx(1 / 3)
    assert result.acceleration == pytest.approx(5 / 9)


def test_short_distances_trigger_exact_nonlinear_fit() -> None:
    # v²/a = 0.5 m: the 0.1 m and 0.3 m runs never reach top speed, so the line fit is biased.
    result = fit_profile(exact(0.5, 0.5, [0.1, 0.3, 1.0, 2.0]))
    assert result.method == "nonlinear_least_squares"
    assert result.max_speed == pytest.approx(0.5, rel=1e-5)
    assert result.acceleration == pytest.approx(0.5, rel=1e-5)


def test_calibration_single_measurement_gives_average_speed() -> None:
    result = fit_profile([Measurement(amount=0.1, seconds=0.5)])
    assert result.model == "constant_speed"
    assert result.max_speed == pytest.approx(0.2)
    assert result.acceleration is None
    assert any("two different" in w for w in result.warnings)


def test_calibration_repeated_single_distance_averages() -> None:
    result = fit_profile(
        [Measurement(amount=0.5, seconds=2.0), Measurement(amount=0.5, seconds=3.0)]
    )
    assert result.model == "constant_speed"
    assert result.max_speed == pytest.approx(1.0 / 5.0)


def test_calibration_decreasing_times_warns_and_stays_finite() -> None:
    result = fit_profile(
        [Measurement(amount=0.2, seconds=3.0), Measurement(amount=1.0, seconds=1.0)]
    )
    assert result.model == "constant_speed"
    assert math.isfinite(result.max_speed)
    assert any("do not increase" in w for w in result.warnings)


def test_calibration_without_overhead_uses_constant_speed() -> None:
    # Times exactly proportional to distance: no acceleration is measurable.
    result = fit_profile(
        [Measurement(amount=0.5, seconds=1.0), Measurement(amount=1.0, seconds=2.0)]
    )
    assert result.model == "constant_speed"
    assert result.max_speed == pytest.approx(0.5)


def test_noisy_data_reports_residuals() -> None:
    data = exact(0.4, 0.8, [0.5, 1.0, 1.5, 2.0])
    noisy = [
        Measurement(amount=m.amount, seconds=m.seconds + e)
        for m, e in zip(data, [0.05, -0.04, 0.03, -0.02], strict=True)
    ]
    result = fit_profile(noisy)
    assert 0.9 < (result.r_squared or 0) < 1.0
    assert len(result.residuals) == 4
