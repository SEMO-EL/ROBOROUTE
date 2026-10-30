"""Competition format (design doc §2, §8.1)."""

from typing import Literal, Self

from pydantic import Field, model_validator

from roboroute.engine.models.base import StrictModel


class CompetitionFormat(StrictModel):
    """How a match is structured.

    ``single_run`` (WRO RoboMission style): one continuous attempt, no touching the robot.
    ``multi_run`` (FLL Challenge style): the robot returns to a home zone between runs, where the
    team may change attachments; ``reset_time`` is the handling time spent in home per return.
    ``must_end_in_home``: the plan must finish with the robot in a home zone.
    """

    kind: Literal["single_run", "multi_run"]
    time_budget: float = Field(gt=0.0, le=600.0, description="Match length in seconds")
    reset_time: float = Field(default=0.0, ge=0.0, le=120.0)
    must_end_in_home: bool = False

    @model_validator(mode="after")
    def _reset_only_for_multi_run(self) -> Self:
        if self.kind == "single_run" and self.reset_time > 0:
            raise ValueError("reset_time only applies to multi_run formats")
        return self
