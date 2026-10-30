"""Declarative scoring rules (design doc §10).

Rules are data, never expressions: no user code is executed, and expected scores remain
computable in closed form.
"""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from roboroute.engine.models.base import Identifier, Label, Points, StrictModel


class MissionPoints(StrictModel):
    """``points`` are awarded when ``mission`` succeeds."""

    kind: Literal["mission_points"] = "mission_points"
    mission: Identifier
    points: Points


class AllOfBonus(StrictModel):
    """``points`` are awarded when every listed mission succeeds."""

    kind: Literal["all_of_bonus"] = "all_of_bonus"
    missions: list[Identifier] = Field(min_length=2, max_length=32)
    points: Points

    @model_validator(mode="after")
    def _distinct(self) -> Self:
        if len(set(self.missions)) != len(self.missions):
            raise ValueError("all_of_bonus missions must be distinct")
        return self


class FailurePenalty(StrictModel):
    """``points`` are subtracted when ``mission`` is attempted and ends failed."""

    kind: Literal["failure_penalty"] = "failure_penalty"
    mission: Identifier
    points: Points


ScoringRule = Annotated[MissionPoints | AllOfBonus | FailurePenalty, Field(discriminator="kind")]


class ScoringProfile(StrictModel):
    id: Identifier
    name: Label
    rules: list[ScoringRule] = Field(default_factory=list, max_length=200)
