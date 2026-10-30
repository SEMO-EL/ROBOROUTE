"""Arena description: field size, obstacles, home zones and the start pose."""

from typing import Literal, Self

from pydantic import Field, model_validator

from roboroute.engine.models.base import Identifier, Label, Length, StrictModel
from roboroute.engine.models.geometry import Pose, RectShape, Shape

MAX_GRID_CELLS = 400_000


class Obstacle(StrictModel):
    """Something the robot's footprint must not overlap.

    ``solid`` is a physical object (mission model, wall); ``no_go`` is an area the team chooses or
    is required to avoid. Both are treated identically by the planner; the kind only affects how
    the UI draws them.
    """

    id: Identifier
    label: Label
    kind: Literal["solid", "no_go"] = "solid"
    shape: Shape


class Zone(StrictModel):
    """A home / launch area. In multi-run formats the robot returns here between runs."""

    id: Identifier
    label: Label
    shape: RectShape


class Arena(StrictModel):
    width: Length
    height: Length
    grid_resolution: float = Field(ge=0.002, le=0.25, description="Grid cell size in metres")
    obstacles: list[Obstacle] = Field(default_factory=list, max_length=200)
    home_zones: list[Zone] = Field(default_factory=list, max_length=4)
    start_pose: Pose

    @model_validator(mode="after")
    def _check_bounds(self) -> Self:
        h = self.grid_resolution
        if h > min(self.width, self.height):
            raise ValueError("grid_resolution must not exceed the arena's smaller side")
        cells = round(self.width / h) * round(self.height / h)
        if cells > MAX_GRID_CELLS:
            raise ValueError(
                f"the grid would have {cells:,} cells (limit {MAX_GRID_CELLS:,}); "
                "use a coarser grid_resolution"
            )
        if not self.contains(self.start_pose.x, self.start_pose.y):
            raise ValueError("start_pose must lie inside the arena")
        return self

    def contains(self, x: float, y: float) -> bool:
        return 0.0 <= x <= self.width and 0.0 <= y <= self.height
