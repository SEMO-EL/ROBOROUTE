"""Geometric primitives in the arena frame (metres, radians; see design doc §5)."""

from typing import Annotated, Literal

from pydantic import Field

from roboroute.engine.models.base import Coordinate, Heading, Length, StrictModel


class Pose(StrictModel):
    """A position plus a heading (counter-clockwise from +x, normalised to (-π, π])."""

    x: Coordinate
    y: Coordinate
    theta: Heading = 0.0


class RectShape(StrictModel):
    """Rectangle given by its centre, size and rotation about the centre."""

    kind: Literal["rect"] = "rect"
    cx: Coordinate
    cy: Coordinate
    width: Length
    height: Length
    rotation: Heading = 0.0


class CircleShape(StrictModel):
    kind: Literal["circle"] = "circle"
    cx: Coordinate
    cy: Coordinate
    radius: Length


Shape = Annotated[RectShape | CircleShape, Field(discriminator="kind")]
