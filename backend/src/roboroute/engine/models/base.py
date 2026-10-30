"""Shared building blocks for all domain models.

Every model rejects unknown fields, NaN and infinity, and is immutable once validated. Numeric
bounds are explicit so that a malformed or hostile file cannot request unbounded work.
"""

from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from roboroute.engine.units import normalize_angle


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        allow_inf_nan=False,
        str_strip_whitespace=True,
    )


Identifier = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
Label = Annotated[str, StringConstraints(min_length=1, max_length=120)]
Description = Annotated[str, StringConstraints(max_length=2000)]

# Lengths and coordinates in metres. 20 m comfortably covers any robotics field.
Length = Annotated[float, Field(gt=0.0, le=20.0)]
NonNegativeLength = Annotated[float, Field(ge=0.0, le=20.0)]
Coordinate = Annotated[float, Field(ge=-20.0, le=40.0)]

# Headings in radians, stored normalised to (-π, π].
Heading = Annotated[float, Field(ge=-1e4, le=1e4), AfterValidator(normalize_angle)]

# Durations in seconds. No single activity in a robot game lasts more than 10 minutes.
Duration = Annotated[float, Field(ge=0.0, le=600.0)]

Probability = Annotated[float, Field(ge=0.0, le=1.0)]
Points = Annotated[float, Field(ge=0.0, le=100_000.0)]
