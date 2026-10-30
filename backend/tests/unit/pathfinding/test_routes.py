import math

import pytest

from roboroute.engine.geometry.clearance import ClearanceField
from roboroute.engine.models import Scenario
from roboroute.engine.pathfinding.heuristics import Heuristic
from roboroute.engine.pathfinding.routes import (
    RouteOptions,
    RoutePlanner,
    RouteStatus,
    compress_collinear,
    polyline_length,
)
from roboroute.engine.pathfinding.smoothing import shortcut
from tests.factories import scenario_dict


def _planner(**arena_updates: object) -> RoutePlanner:
    data = scenario_dict()
    # Route tests only need the arena and robot; missions would constrain the arena size.
    data["missions"], data["constraints"], data["scoring"]["rules"] = [], [], []
    data["arena"].update(arena_updates)
    return RoutePlanner(Scenario.model_validate(data))


def test_route_around_wall_is_collision_free_and_smoothed() -> None:
    planner = _planner()
    result = planner.plan((0.3, 0.3), (1.6, 0.9), RouteOptions())
    assert result.status is RouteStatus.OK
    assert result.smoothed_points[0] == (0.3, 0.3)
    assert result.smoothed_points[-1] == (1.6, 0.9)
    assert result.length_smoothed <= result.length_raw + 1e-12
    assert result.length_smoothed >= math.dist((0.3, 0.3), (1.6, 0.9))
    radius = planner.radius
    for a, b in zip(result.smoothed_points, result.smoothed_points[1:], strict=False):
        assert planner.field.segment(a, b) >= radius - 1e-9


def test_dijkstra_and_astar_find_equally_short_grid_paths() -> None:
    planner = _planner()
    a = planner.plan((0.3, 0.3), (1.6, 0.9), RouteOptions(algorithm="astar"))
    d = planner.plan((0.3, 0.3), (1.6, 0.9), RouteOptions(algorithm="dijkstra"))
    assert a.search is not None
    assert d.search is not None
    assert a.search.cost == pytest.approx(d.search.cost)
    assert a.search.expanded <= d.search.expanded


def test_non_admissible_option_is_reported() -> None:
    result = _planner().plan(
        (0.3, 0.3), (1.6, 0.9), RouteOptions(heuristic=Heuristic.MANHATTAN, connectivity=8)
    )
    assert result.status is RouteStatus.OK
    assert result.optimality_guaranteed is False


def test_pose_in_collision_reported() -> None:
    result = _planner().plan((0.3, 0.3), (1.0, 0.6), RouteOptions())
    assert result.status is RouteStatus.POSE_IN_COLLISION
    assert "100.0 cm, 60.0 cm" in result.message


def test_unreachable_goal() -> None:
    planner = _planner(
        obstacles=[
            {
                "id": "divider",
                "label": "Divider",
                "kind": "solid",
                "shape": {"kind": "rect", "cx": 1.0, "cy": 0.6, "width": 0.05, "height": 1.2},
            }
        ]
    )
    result = planner.plan((0.3, 0.3), (1.6, 0.9), RouteOptions())
    assert result.status is RouteStatus.UNREACHABLE


def test_snap_connects_pose_whose_own_cell_is_blocked() -> None:
    planner = _planner(obstacles=[])
    # Clearance 0.13 m ≥ R = 0.125 m, but the cell centre needs R + h√2/2 ≈ 0.139 m.
    start = (0.13, 0.6)
    assert not planner.grid.is_free(planner.grid.cell_of(start))
    result = planner.plan(start, (1.5, 0.6), RouteOptions())
    assert result.status is RouteStatus.OK
    assert result.smoothed_points[0] == start


def test_snap_failed_in_slot_narrower_than_grid_allows() -> None:
    planner = _planner(
        width=0.254,
        height=1.0,
        obstacles=[],
        home_zones=[],
        start_pose={"x": 0.127, "y": 0.2, "theta": 0.0},
    )
    result = planner.plan((0.127, 0.2), (0.127, 0.8), RouteOptions())
    assert result.status is RouteStatus.SNAP_FAILED
    assert "finer grid" in result.message


def test_same_start_and_goal() -> None:
    result = _planner().plan((0.5, 0.5), (0.5, 0.5), RouteOptions())
    assert result.status is RouteStatus.OK
    assert result.length_smoothed == 0.0


def test_compress_collinear() -> None:
    points = [(0.0, 0.0), (1.0, 0.0), (2.0, 0.0), (2.0, 1.0), (2.0, 2.0)]
    assert compress_collinear(points) == [(0.0, 0.0), (2.0, 0.0), (2.0, 2.0)]


def test_shortcut_with_everything_visible_is_a_straight_line() -> None:
    points = [(0.0, 0.0), (1.0, 1.0), (2.0, 0.0), (3.0, 1.0)]
    assert shortcut(points, lambda a, b: True) == [(0.0, 0.0), (3.0, 1.0)]


def test_shortcut_with_nothing_visible_keeps_the_path() -> None:
    points = [(0.0, 0.0), (1.0, 1.0), (2.0, 0.0)]
    assert shortcut(points, lambda a, b: math.dist(a, b) <= 1.5) == points
    assert polyline_length(points) == pytest.approx(2 * math.sqrt(2))


def test_route_clearance_field_is_shared() -> None:
    planner = _planner()
    assert isinstance(planner.field, ClearanceField)
