"""Relationships between missions (design doc §8.1)."""

from typing import Annotated, Literal

from pydantic import Field

from roboroute.engine.models.base import Identifier, StrictModel


class Requires(StrictModel):
    """``after`` may only be done if ``before`` was done earlier.

    ``semantics = "succeeded"``: ``after`` only scores if ``before`` succeeded (the robot skips
    ``after`` when ``before`` failed). ``"attempted"``: ``before`` only has to be attempted.
    """

    kind: Literal["requires"] = "requires"
    before: Identifier
    after: Identifier
    semantics: Literal["attempted", "succeeded"] = "succeeded"


class Precedes(StrictModel):
    """If both missions are chosen, ``before`` must come first. Neither requires the other."""

    kind: Literal["precedes"] = "precedes"
    before: Identifier
    after: Identifier


class Excludes(StrictModel):
    """At most one of the two missions may be chosen."""

    kind: Literal["excludes"] = "excludes"
    a: Identifier
    b: Identifier


Constraint = Annotated[Requires | Precedes | Excludes, Field(discriminator="kind")]
