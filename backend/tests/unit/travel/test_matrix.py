import math

import pytest

from roboroute.engine.models import Scenario
from roboroute.engine.motion.timing import time_path
from roboroute.engine.pathfinding.routes import RouteOptions, RoutePlanner, RouteStatus
from roboroute.engine.scenarios import load_scenario
from roboroute.engine.travel.matrix import START, build_travel_matrix
from tests.factories import scenario_dict
from tests.paths import SCENARIOS_DIR


def _scenario(**updates: object) -> Scenario:
    data = scenario_dict()
    data.update(updates)
    return Scenario.model_validate(data)


def test_nodes_are_start_then_missions() -> None:
    matrix = build_travel_matrix(_scenario())
    assert matrix.nodes == [START, "m1", "m2"]


def test_diagonal_is_zero() -> None:
    matrix = build_travel_matrix(_scenario())
    for node in matrix.nodes:
        assert matrix.seconds(node, node) == 0.0


def test_every_leg_matches_route_plus_timing() -> None:
    scenario = load_scenario(SCENARIOS_DIR / "a-simple-arena.json")
    matrix = build_travel_matrix(scenario)
    planner = RoutePlanner(scenario)
    poses = {START: scenario.arena.start_pose} | {m.id: m.approach_pose for m in scenario.missions}
    for a in matrix.nodes:
        for b in matrix.nodes:
            if a == b:
                continue
            route = planner.plan(
                (poses[a].x, poses[a].y),
                (poses[b].x, poses[b].y),
                RouteOptions(algorithm="dijkstra"),
            )
            assert route.status is RouteStatus.OK
            end_heading = None if b == START else poses[b].theta
            expected = time_path(route.smoothed_points, poses[a].theta, end_heading, scenario.robot)
            leg = matrix.legs[(a, b)]
            assert leg.seconds == pytest.approx(expected.total)
            assert leg.length == pytest.approx(route.length_smoothed)
            assert leg.provenance == "modeled"


def test_return_to_start_needs_no_final_heading() -> None:
    matrix = build_travel_matrix(_scenario())
    leg = matrix.legs[("m1", START)]
    assert leg.timing is not None
    assert leg.timing.legs[-1].kind == "drive"


def test_measured_override_replaces_modeled_time() -> None:
    scenario = _scenario(travel_overrides=[{"from_node": START, "to_node": "m1", "seconds": 4.2}])
    matrix = build_travel_matrix(scenario)
    leg = matrix.legs[(START, "m1")]
    assert leg.seconds == 4.2
    assert leg.provenance == "measured"
    assert leg.modeled_seconds is not None
    assert leg.modeled_seconds != 4.2


def test_unreachable_mission_reported_with_reason() -> None:
    data = scenario_dict()
    data["missions"][1]["approach_pose"] = {"x": 1.0, "y": 0.6, "theta": 0.0}  # inside the wall
    matrix = build_travel_matrix(Scenario.model_validate(data))
    assert (START, "m2") not in matrix.legs
    failure = matrix.failures[(START, "m2")]
    assert failure.status is RouteStatus.POSE_IN_COLLISION
    assert math.isinf(matrix.seconds(START, "m2"))


def test_override_with_unknown_node_rejected() -> None:
    with pytest.raises(ValueError, match="nowhere"):
        _scenario(travel_overrides=[{"from_node": START, "to_node": "nowhere", "seconds": 1.0}])


def test_mission_cannot_use_reserved_start_id() -> None:
    data = scenario_dict()
    data["missions"][0]["id"] = "start"
    data["constraints"] = []
    data["scoring"]["rules"] = []
    with pytest.raises(ValueError, match="reserved"):
        Scenario.model_validate(data)
