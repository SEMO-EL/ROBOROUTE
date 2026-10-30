"""Time along a polyline for a robot that drives straight segments and turns on the spot.

Each segment can be driven forwards (robot heading = segment direction φ) or, if the robot may
reverse, backwards (robot heading = φ + π). The choice changes only how far the robot must turn
before and after the segment. A dynamic program over segments with two states (forwards,
backwards) picks the combination with the least total turning time — e.g. backing out of a
mission instead of turning around. O(n) for n segments.
"""

import itertools
import math
from dataclasses import dataclass
from typing import Literal

from roboroute.engine.geometry.primitives import Point
from roboroute.engine.models import Robot
from roboroute.engine.motion.profiles import profile_time
from roboroute.engine.units import angle_difference


@dataclass(frozen=True)
class Leg:
    kind: Literal["turn", "drive"]
    amount: float  # radians for turns (signed, CCW positive), metres for drives
    seconds: float
    reverse: bool = False


@dataclass(frozen=True)
class PathTiming:
    total: float
    translation: float
    rotation: float
    distance: float
    legs: list[Leg]


def _turn(robot: Robot, from_heading: float, to_heading: float) -> Leg | None:
    delta = angle_difference(from_heading, to_heading)
    if abs(delta) < 1e-12:
        return None
    return Leg("turn", delta, profile_time(abs(delta), robot.angular))


def _turn_seconds(robot: Robot, from_heading: float, to_heading: float) -> float:
    return profile_time(abs(angle_difference(from_heading, to_heading)), robot.angular)


def time_path(
    points: list[Point], start_heading: float, end_heading: float | None, robot: Robot
) -> PathTiming:
    """Total time to follow ``points`` starting at ``start_heading``.

    ``end_heading`` is the heading required at the end (a mission's approach heading), or ``None``
    if any heading will do.
    """
    segments = [
        (math.atan2(b[1] - a[1], b[0] - a[0]), math.dist(a, b))
        for a, b in itertools.pairwise(points)
        if math.dist(a, b) > 1e-12
    ]
    directions = (False, True) if robot.can_reverse else (False,)

    def heading(index: int, reverse: bool) -> float:
        phi = segments[index][0]
        return phi + math.pi if reverse else phi

    # cost[d]: least turning time so far with the latest segment driven in direction d.
    cost: dict[bool, float] = {}
    choice: list[dict[bool, bool]] = []
    for index in range(len(segments)):
        step: dict[bool, float] = {}
        back: dict[bool, bool] = {}
        for reverse in directions:
            here = heading(index, reverse)
            if index == 0:
                step[reverse] = _turn_seconds(robot, start_heading, here)
                back[reverse] = reverse
            else:
                best = min(
                    directions,
                    key=lambda prev: (
                        cost[prev] + _turn_seconds(robot, heading(index - 1, prev), here)
                    ),
                )
                step[reverse] = cost[best] + _turn_seconds(robot, heading(index - 1, best), here)
                back[reverse] = best
        cost = step
        choice.append(back)

    # Choose the final direction including the turn to the required end heading.
    plan: list[bool] = []
    if segments:

        def final_cost(reverse: bool) -> float:
            if end_heading is None:
                return cost[reverse]
            return cost[reverse] + _turn_seconds(
                robot, heading(len(segments) - 1, reverse), end_heading
            )

        last = min(directions, key=final_cost)
        plan = [last]
        for index in range(len(segments) - 1, 0, -1):
            plan.append(choice[index][plan[-1]])
        plan.reverse()

    legs: list[Leg] = []
    current = start_heading
    for index, reverse in enumerate(plan):
        target = heading(index, reverse)
        turn = _turn(robot, current, target)
        if turn is not None:
            legs.append(turn)
        length = segments[index][1]
        legs.append(Leg("drive", length, profile_time(length, robot.linear), reverse))
        current = target
    if end_heading is not None:
        turn = _turn(robot, current, end_heading)
        if turn is not None:
            legs.append(turn)

    translation = sum(leg.seconds for leg in legs if leg.kind == "drive")
    rotation = sum(leg.seconds for leg in legs if leg.kind == "turn")
    distance = sum(length for _, length in segments)
    return PathTiming(translation + rotation, translation, rotation, distance, legs)
