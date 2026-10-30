import math

import pytest
from pydantic import ValidationError

from roboroute.engine.models import CircleShape, Pose, RectShape


def test_pose_heading_is_normalised() -> None:
    pose = Pose(x=0.0, y=0.0, theta=3 * math.pi)
    assert pose.theta == pytest.approx(math.pi)


def test_pose_rejects_nan() -> None:
    with pytest.raises(ValidationError):
        Pose(x=float("nan"), y=0.0, theta=0.0)


def test_rect_requires_positive_size() -> None:
    with pytest.raises(ValidationError):
        RectShape(cx=0.5, cy=0.5, width=0.0, height=0.2)


def test_circle_requires_positive_radius() -> None:
    with pytest.raises(ValidationError):
        CircleShape(cx=0.5, cy=0.5, radius=-0.1)


def test_models_reject_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        Pose.model_validate({"x": 0, "y": 0, "theta": 0, "z": 1})
