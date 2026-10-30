"""Measured travel times that replace modelled ones (design doc §7)."""

from roboroute.engine.models.base import Duration, Identifier, StrictModel

START_NODE = "start"
"""Node id of the start pose. In multi-run formats it is also where the robot returns home."""


class TravelOverride(StrictModel):
    """A stopwatch time for driving from one node to another, used instead of the model."""

    from_node: Identifier
    to_node: Identifier
    seconds: Duration
