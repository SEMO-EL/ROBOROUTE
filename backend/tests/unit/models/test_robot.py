import pytest
from pydantic import ValidationError

from roboroute.engine.models import MotionProfile, Robot


def _robot(**overrides: object) -> Robot:
    data: dict[str, object] = {
        "name": "Bot",
        "length": 0.20,
        "width": 0.15,
        "safety_margin": 0.0,
        "linear": MotionProfile(max_speed=0.3, acceleration=0.6, provenance="entered"),
        "angular": MotionProfile(max_speed=3.0, acceleration=None, provenance="reference"),
    }
    data.update(overrides)
    return Robot.model_validate(data)


def test_footprint_radius_is_half_diagonal_plus_margin() -> None:
    assert _robot().footprint_radius == pytest.approx(0.125)
    assert _robot(safety_margin=0.01).footprint_radius == pytest.approx(0.135)


def test_constant_speed_profile_allowed() -> None:
    assert _robot().angular.acceleration is None


def test_zero_speed_rejected() -> None:
    with pytest.raises(ValidationError):
        MotionProfile(max_speed=0.0, acceleration=None, provenance="entered")
