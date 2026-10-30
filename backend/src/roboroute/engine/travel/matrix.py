"""Travel times between all pairs of nodes (start pose and mission approach poses).

For each source node a single Dijkstra search yields shortest grid paths to every other node;
each path is smoothed and timed with the robot's motion model, including the turn from the
source heading and to the target's required heading. Returning to the start (home) accepts any
final heading. Measured times from the user replace modelled ones and are labelled ``measured``.

Assumption: after a mission the robot is back at that mission's approach pose and heading.
"""

import math
from dataclasses import dataclass
from typing import Literal

from roboroute.engine.geometry.primitives import Point
from roboroute.engine.models import START_NODE, Pose, Scenario
from roboroute.engine.motion.timing import PathTiming, time_path
from roboroute.engine.pathfinding.routes import RoutePlanner, RouteStatus

START = START_NODE


@dataclass(frozen=True)
class Leg:
    from_node: str
    to_node: str
    seconds: float
    length: float
    points: list[Point]
    provenance: Literal["modeled", "measured"]
    timing: PathTiming | None
    modeled_seconds: float | None


@dataclass(frozen=True)
class LegFailure:
    from_node: str
    to_node: str
    status: RouteStatus
    message: str


@dataclass(frozen=True)
class TravelMatrix:
    nodes: list[str]
    legs: dict[tuple[str, str], Leg]
    failures: dict[tuple[str, str], LegFailure]

    def seconds(self, a: str, b: str) -> float:
        if a == b:
            return 0.0
        leg = self.legs.get((a, b))
        return math.inf if leg is None else leg.seconds


def node_poses(scenario: Scenario) -> dict[str, Pose]:
    return {START: scenario.arena.start_pose} | {m.id: m.approach_pose for m in scenario.missions}


def build_travel_matrix(scenario: Scenario, planner: RoutePlanner | None = None) -> TravelMatrix:
    planner = planner or RoutePlanner(scenario)
    poses = node_poses(scenario)
    nodes = list(poses)
    overrides = {(o.from_node, o.to_node): o.seconds for o in scenario.travel_overrides}
    legs: dict[tuple[str, str], Leg] = {}
    failures: dict[tuple[str, str], LegFailure] = {}

    for source in nodes:
        origin = poses[source]
        targets = [node for node in nodes if node != source]
        routes = planner.plan_from(
            (origin.x, origin.y), [(poses[t].x, poses[t].y) for t in targets]
        )
        for target, route in zip(targets, routes, strict=True):
            key = (source, target)
            if route.status is not RouteStatus.OK:
                if key in overrides:
                    legs[key] = Leg(
                        source, target, overrides[key], math.nan, [], "measured", None, None
                    )
                else:
                    failures[key] = LegFailure(source, target, route.status, route.message)
                continue
            end_heading = None if target == START else poses[target].theta
            timing = time_path(route.smoothed_points, origin.theta, end_heading, scenario.robot)
            if key in overrides:
                legs[key] = Leg(
                    source,
                    target,
                    overrides[key],
                    route.length_smoothed,
                    route.smoothed_points,
                    "measured",
                    timing,
                    timing.total,
                )
            else:
                legs[key] = Leg(
                    source,
                    target,
                    timing.total,
                    route.length_smoothed,
                    route.smoothed_points,
                    "modeled",
                    timing,
                    timing.total,
                )
    return TravelMatrix(nodes, legs, failures)
