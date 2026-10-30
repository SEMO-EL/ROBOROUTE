from fastapi import APIRouter

from roboroute.api.errors import ApiError
from roboroute.api.schemas.routes import (
    GridResponse,
    LegFailureOut,
    LegOut,
    MatrixResponse,
    RouteRequest,
    RouteResponse,
    ScenarioRequest,
)
from roboroute.engine.grid.occupancy import grid_dimensions
from roboroute.engine.models import Scenario
from roboroute.engine.motion.timing import time_path
from roboroute.engine.pathfinding.routes import RoutePlanner, RouteStatus
from roboroute.engine.pathfinding.trace import RecordingTracer
from roboroute.engine.travel.matrix import START, build_travel_matrix, node_poses

router = APIRouter(prefix="/routes", tags=["routes"])

# Single-source Dijkstra runs once per node; bound the total work per matrix request.
MAX_MATRIX_WORK = 3_000_000


def _cells(scenario: Scenario) -> int:
    columns, rows = grid_dimensions(
        scenario.arena.width, scenario.arena.height, scenario.arena.grid_resolution
    )
    return columns * rows


@router.post("/plan")
def plan_route(request: RouteRequest) -> RouteResponse:
    """Plan a route between two nodes ("start" or a mission id) and time it."""
    poses = node_poses(request.scenario)
    for node in (request.from_node, request.to_node):
        if node not in poses:
            raise ApiError(422, "unknown_node", f"Unknown node '{node}'.")
    origin, target = poses[request.from_node], poses[request.to_node]
    planner = RoutePlanner(request.scenario)
    tracer = RecordingTracer(max_events=request.trace_limit) if request.include_trace else None
    route = planner.plan((origin.x, origin.y), (target.x, target.y), request.options, tracer)
    timing = None
    if route.status is RouteStatus.OK:
        end_heading = None if request.to_node == START else target.theta
        timing = time_path(route.smoothed_points, origin.theta, end_heading, request.scenario.robot)
    return RouteResponse.of(route, timing, tracer)


@router.post("/matrix")
def travel_matrix(request: ScenarioRequest) -> MatrixResponse:
    """Travel times between the start pose and every mission, modelled or measured."""
    scenario = request.scenario
    work = _cells(scenario) * (len(scenario.missions) + 1)
    if work > MAX_MATRIX_WORK:
        raise ApiError(
            422,
            "too_much_work",
            "This grid is too fine for this many missions; use a coarser grid resolution.",
            {"work": work, "limit": MAX_MATRIX_WORK},
        )
    matrix = build_travel_matrix(scenario)
    return MatrixResponse(
        nodes=matrix.nodes,
        legs=[LegOut.of(leg) for leg in matrix.legs.values()],
        failures=[LegFailureOut.of(f) for f in matrix.failures.values()],
    )


@router.post("/grid")
def occupancy_grid(request: ScenarioRequest) -> GridResponse:
    """The planning grid for the scenario's robot, as run-length-encoded blocked cells."""
    planner = RoutePlanner(request.scenario)
    grid = planner.grid
    return GridResponse(
        columns=grid.columns,
        rows=grid.rows,
        resolution=grid.resolution,
        inflation=grid.inflation,
        free_count=grid.free_count,
        blocked_runs=grid.blocked_runs(),
    )
