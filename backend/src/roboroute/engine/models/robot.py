"""Robot description (design doc §6)."""

import math
from typing import Literal

from pydantic import Field

from roboroute.engine.models.base import Label, Length, NonNegativeLength, StrictModel

ParameterProvenance = Literal["calibrated", "entered", "reference"]

# Bounds for both translation (m/s, m/s²) and rotation (rad/s, rad/s²).
MAX_SPEED = 50.0
MAX_ACCELERATION = 500.0


class MotionProfile(StrictModel):
    """Speed limits for one degree of freedom.

    For translation: ``max_speed`` in m/s and ``acceleration`` in m/s².
    For rotation: ``max_speed`` in rad/s and ``acceleration`` in rad/s².
    ``acceleration = None`` means a constant-speed model (instant start and stop).

    ``provenance`` records where the numbers came from: ``calibrated`` (fitted from the user's
    measurements), ``entered`` (typed by the user) or ``reference`` (manufacturer ceiling).
    """

    max_speed: float = Field(gt=0.0, le=MAX_SPEED)
    acceleration: float | None = Field(default=None, gt=0.0, le=MAX_ACCELERATION)
    provenance: ParameterProvenance = "entered"


class Robot(StrictModel):
    name: Label
    drive: Literal["differential"] = "differential"
    length: Length
    width: Length
    safety_margin: NonNegativeLength = 0.0
    linear: MotionProfile
    angular: MotionProfile
    can_reverse: bool = Field(
        default=True,
        description="Whether the robot may drive backwards instead of turning around",
    )

    @property
    def footprint_radius(self) -> float:
        """Radius of the circumscribed disc used for collision checking, plus the margin."""
        return 0.5 * math.hypot(self.length, self.width) + self.safety_margin
