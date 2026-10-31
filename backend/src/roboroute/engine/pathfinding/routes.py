"""Collision-free routes between two arena positions.

Pipeline: check both positions against the exact clearance field → connect each to a nearby free
grid cell with an exactly-checked straight segment ("snapping") → grid search (A* or Dijkstra) →
drop collinear points → line-of-sight smoothing with the exact clearance check.
"""

import itertools
import math
from dataclasses import dataclass, field, replace
from enum import StrEnum
from typing import Literal

from roboroute.engine.geometry.clearance import ClearanceField
from roboroute.engine.geometry.primitives import Point
from roboroute.engine.grid.occupancy import Cell, OccupancyGrid, build_grid
from roboroute.engine.models import Scenario
from roboroute.engine.models.base import StrictModel
from roboroute.engine.pathfinding.heuristics import Heuristic
from roboroute.engine.pathfinding.search import astar, dijkstra
from roboroute.engine.pathfinding.smoothing import shortcut
from roboroute.engine.pathfinding.trace import Tracer
from roboroute.engine.units import format_point_cm

SNAP_RING = 3  # how many cells around a position are tried when snapping it to the grid
EPS = 1e-12


class RouteOptions(StrictModel):
    algorithm: Literal["astar", "dijkstra"] = "astar"
    heuristic: Heuristic = Heuristic.OCTILE
    connectivity: Literal[4, 8] = 8
    smooth: bool = True


class RouteStatus(StrEnum):
    OK = "ok"
    POSE_IN_COLLISION = "pose_in_collision"
    SNAP_FAILED = "snap_failed"
    UNREACHABLE = "unreachable"


@dataclass(frozen=True)
class SearchStats:
    algorithm: str
    expanded: int
    cost: float
    optimality_guaranteed: bool


@dataclass(frozen=True)
class RouteResult:
    status: RouteStatus
    message: str
    raw_points: list[Point]
    smoothed_points: list[Point]
    length_raw: float
    length_smoothed: float
    search: SearchStats | None
    # Grid cells the search ran between, and the cell path it found (empty if none).
    start_cell: Cell | None = None
    goal_cell: Cell | None = None
    grid_path: list[Cell] = field(default_factory=list)

    @property
    def optimality_guaranteed(self) -> bool:
        return self.search is not None and self.search.optimality_guaranteed


def polyline_length(points: list[Point]) -> float:
    return sum(math.dist(a, b) for a, b in itertools.pairwise(points))


def compress_collinear(points: list[Point]) -> list[Point]:
    """Remove interior points that lie on a straight line between their neighbours."""
    if len(points) <= 2:
        return list(points)
    result = [points[0]]
    for current, following in itertools.pairwise(points):
        previous = result[-1]
        cross = (current[0] - previous[0]) * (following[1] - current[1]) - (
            current[1] - previous[1]
        ) * (following[0] - current[0])
        if abs(cross) > 1e-12:
            result.append(current)
    result.append(points[-1])
    return result


def _failure(status: RouteStatus, message: str) -> RouteResult:
    return RouteResult(status, message, [], [], math.inf, math.inf, None)


class RoutePlanner:
    """Plans routes in one scenario. The grid and clearance field are built once and reused."""

    def __init__(self, scenario: Scenario) -> None:
        self.radius = scenario.robot.footprint_radius
        self.field = ClearanceField(scenario.arena)
        self.grid: OccupancyGrid = build_grid(scenario.arena, self.radius)

    def is_free(self, a: Point, b: Point) -> bool:
        return self.field.segment(a, b) >= self.radius - EPS

    def snap(self, p: Point) -> Cell | None:
        """The nearest free cell whose centre is reachable from ``p`` in a straight free line."""
        ci, cj = self.grid.cell_of(p)
        candidates = [
            (ci + di, cj + dj)
            for di in range(-SNAP_RING, SNAP_RING + 1)
            for dj in range(-SNAP_RING, SNAP_RING + 1)
        ]
        candidates.sort(key=lambda c: (math.dist(p, self.grid.center_of(c)), c))
        for cell in candidates:
            if self.grid.is_free(cell) and self.is_free(p, self.grid.center_of(cell)):
                return cell
        return None

    def _check_positions(self, positions: list[tuple[str, Point]]) -> RouteResult | None:
        for label, point in positions:
            if self.field.at(point) < self.radius - EPS:
                return _failure(
                    RouteStatus.POSE_IN_COLLISION,
                    f"The {label} position {format_point_cm(point)} is too close to an obstacle "
                    f"or wall for a robot of collision radius {self.radius * 100:.1f} cm.",
                )
        return None

    @staticmethod
    def _snap_failure(point: Point) -> RouteResult:
        return _failure(
            RouteStatus.SNAP_FAILED,
            f"The position {format_point_cm(point)} is collision-free, but no planning-grid "
            f"cell within {SNAP_RING} cells can be reached in a straight line. "
            "Try a finer grid resolution.",
        )

    def _finish(
        self,
        start: Point,
        goal: Point,
        cells: list[Cell] | None,
        stats: SearchStats,
        smooth: bool,
    ) -> RouteResult:
        if cells is None:
            return RouteResult(
                RouteStatus.UNREACHABLE,
                f"No collision-free route from {format_point_cm(start)} to "
                f"{format_point_cm(goal)} exists at this grid resolution.",
                [],
                [],
                math.inf,
                math.inf,
                stats,
            )
        raw = compress_collinear([start, *(self.grid.center_of(c) for c in cells), goal])
        smoothed = shortcut(raw, self.is_free) if smooth else raw
        return RouteResult(
            RouteStatus.OK,
            "",
            raw,
            smoothed,
            polyline_length(raw),
            polyline_length(smoothed),
            stats,
        )

    def plan(
        self, start: Point, goal: Point, options: RouteOptions, tracer: Tracer | None = None
    ) -> RouteResult:
        failure = self._check_positions([("start", start), ("goal", goal)])
        if failure is not None:
            return failure
        if start == goal:
            return RouteResult(RouteStatus.OK, "", [start], [start], 0.0, 0.0, None)

        start_cell, goal_cell = self.snap(start), self.snap(goal)
        if start_cell is None:
            return self._snap_failure(start)
        if goal_cell is None:
            return self._snap_failure(goal)

        if options.algorithm == "astar":
            result = astar(
                self.grid, start_cell, goal_cell, options.heuristic, options.connectivity, tracer
            )
            stats = SearchStats(
                result.algorithm, result.expanded, result.cost, result.optimality_guaranteed
            )
            finished = self._finish(start, goal, result.path, stats, options.smooth)
            return replace(
                finished, start_cell=start_cell, goal_cell=goal_cell, grid_path=result.path or []
            )

        tree = dijkstra(self.grid, start_cell, [goal_cell], options.connectivity, tracer)
        stats = SearchStats(
            f"dijkstra[{options.connectivity}]",
            tree.expanded,
            tree.dist.get(goal_cell, math.inf),
            True,
        )
        cells = tree.path_to(goal_cell)
        finished = self._finish(start, goal, cells, stats, options.smooth)
        return replace(finished, start_cell=start_cell, goal_cell=goal_cell, grid_path=cells or [])

    def plan_from(
        self, start: Point, goals: list[Point], connectivity: int = 8, smooth: bool = True
    ) -> list[RouteResult]:
        """Routes from one start to many goals with a single Dijkstra search.

        Produces the same routes as ``plan(..., RouteOptions(algorithm="dijkstra"))`` for each
        goal: with deterministic tie-breaking, stopping later does not change the parent of any
        cell that was already settled.
        """
        failure = self._check_positions([("start", start)])
        if failure is not None:
            return [failure for _ in goals]
        start_cell = self.snap(start)
        if start_cell is None:
            return [self._snap_failure(start) for _ in goals]

        goal_cells: list[Cell | None] = []
        results: list[RouteResult | None] = []
        for goal in goals:
            problem = self._check_positions([("goal", goal)])
            cell = None if problem is not None else self.snap(goal)
            if problem is None and cell is None:
                problem = self._snap_failure(goal)
            if problem is None and goal == start:
                problem = RouteResult(RouteStatus.OK, "", [start], [start], 0.0, 0.0, None)
            goal_cells.append(cell)
            results.append(problem)

        tree = dijkstra(
            self.grid,
            start_cell,
            [c for c, r in zip(goal_cells, results, strict=True) if c is not None and r is None],
            connectivity,
        )
        finished: list[RouteResult] = []
        for goal, cell, result in zip(goals, goal_cells, results, strict=True):
            if result is not None or cell is None:
                finished.append(result if result is not None else self._snap_failure(goal))
                continue
            stats = SearchStats(
                f"dijkstra[{connectivity}]", tree.expanded, tree.dist.get(cell, math.inf), True
            )
            finished.append(self._finish(start, goal, tree.path_to(cell), stats, smooth))
        return finished
