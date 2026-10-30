"""Mission definitions (design doc §8.1). Points live in the scoring profile, not here."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from roboroute.engine.models.base import Description, Identifier, Label, Probability, StrictModel
from roboroute.engine.models.distributions import Distribution
from roboroute.engine.models.geometry import Pose


class ProbabilitySuccess(StrictModel):
    """A per-attempt success probability entered directly."""

    kind: Literal["probability"] = "probability"
    p: Probability

    def point_estimate(self) -> float:
        return self.p


class CountsSuccess(StrictModel):
    """Success measured in practice: ``successes`` out of ``attempts``.

    The point estimate is the posterior mean under a uniform Beta(1, 1) prior,
    ``(s + 1) / (n + 2)`` (Laplace's rule of succession). It never returns exactly 0 or 1, because
    a finite number of practice runs cannot establish certainty.
    """

    kind: Literal["counts"] = "counts"
    successes: int = Field(ge=0, le=100_000)
    attempts: int = Field(ge=1, le=100_000)

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.successes > self.attempts:
            raise ValueError("successes cannot exceed attempts")
        return self

    def point_estimate(self) -> float:
        return (self.successes + 1) / (self.attempts + 2)


SuccessModel = Annotated[ProbabilitySuccess | CountsSuccess, Field(discriminator="kind")]


class Mission(StrictModel):
    """A task on the field.

    ``approach_pose`` is where the robot must be (and which way it must face) to start the
    mission. It must be collision-free; the contact manoeuvre itself is part of
    ``execution_time``. If ``max_attempts > 1`` and ``retry_time`` is omitted, each retry is
    assumed to take as long as the first attempt.
    """

    id: Identifier
    name: Label
    description: Description = ""
    approach_pose: Pose
    execution_time: Distribution
    success: SuccessModel
    max_attempts: int = Field(default=1, ge=1, le=10)
    retry_time: Distribution | None = None
    attachment: Label | None = None
