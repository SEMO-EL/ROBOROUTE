import pytest
from pydantic import ValidationError

from roboroute.engine.models import CountsSuccess, Fixed, Mission, Pose, ProbabilitySuccess


def test_probability_point_estimate_is_the_probability() -> None:
    assert ProbabilitySuccess(p=0.85).point_estimate() == pytest.approx(0.85)


def test_counts_use_posterior_mean_under_uniform_prior() -> None:
    # 10 successes in 10 attempts is not certainty: (s + 1) / (n + 2) = 11/12.
    assert CountsSuccess(successes=10, attempts=10).point_estimate() == pytest.approx(11 / 12)


def test_counts_cannot_exceed_attempts() -> None:
    with pytest.raises(ValidationError):
        CountsSuccess(successes=11, attempts=10)


def test_probability_outside_unit_interval_rejected() -> None:
    with pytest.raises(ValidationError):
        ProbabilitySuccess(p=1.2)


def test_mission_attempts_bounded() -> None:
    with pytest.raises(ValidationError):
        Mission(
            id="m",
            name="M",
            approach_pose=Pose(x=0, y=0, theta=0),
            execution_time=Fixed(value=1),
            success=ProbabilitySuccess(p=0.5),
            max_attempts=0,
        )


def test_mission_id_pattern_enforced() -> None:
    with pytest.raises(ValidationError):
        Mission(
            id="has space",
            name="M",
            approach_pose=Pose(x=0, y=0, theta=0),
            execution_time=Fixed(value=1),
            success=ProbabilitySuccess(p=0.5),
        )
