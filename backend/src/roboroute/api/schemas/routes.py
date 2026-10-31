"""API request and response models for routing. Engine dataclasses are converted here."""

from typing import Literal

from pydantic import BaseModel, Field

from roboroute.engine.models import Scenario
from roboroute.engine.models.base import Identifier
from roboroute.engine.motion.timing import PathTiming
from roboroute.engine.pathfinding.routes import RouteOptions, RouteResult, SearchStats
from roboroute.engine.pathfinding.trace import RecordingTracer
from roboroute.engine.travel.matrix import Leg, LegFailure

PointOut = tuple[float, float]


class RouteRequest(BaseModel):
    model_config = {"extra": "forbid"}

    scenario: Scenario
    from_node: Identifier
    to_node: Identifier
    options: RouteOptions = RouteOptions()
    include_trace: bool = False
    trace_limit: int = Field(default=20_000, ge=1, le=100_000)


class ScenarioRequest(BaseModel):
    model_config = {"extra": "forbid"}

    scenario: Scenario


class SearchStatsOut(BaseModel):
    algorithm: str
    expanded: int
    cost: float | None = Field(description="Grid path cost in metres; null if no path")
    optimality_guaranteed: bool

    @classmethod
    def of(cls, stats: SearchStats) -> "SearchStatsOut":
        cost = stats.cost if stats.cost != float("inf") else None
        return cls(
            algorithm=stats.algorithm,
            expanded=stats.expanded,
            cost=cost,
            optimality_guaranteed=stats.optimality_guaranteed,
        )


class TimingLegOut(BaseModel):
    kind: Literal["turn", "drive"]
    amount: float
    seconds: float
    reverse: bool


class TimingOut(BaseModel):
    total: float
    translation: float
    rotation: float
    distance: float
    legs: list[TimingLegOut]

    @classmethod
    def of(cls, timing: PathTiming) -> "TimingOut":
        return cls(
            total=timing.total,
            translation=timing.translation,
            rotation=timing.rotation,
            distance=timing.distance,
            legs=[
                TimingLegOut(
                    kind=leg.kind, amount=leg.amount, seconds=leg.seconds, reverse=leg.reverse
                )
                for leg in timing.legs
            ],
        )


class TraceEventOut(BaseModel):
    kind: Literal["expand", "push"]
    cell: tuple[int, int]
    parent: tuple[int, int] | None
    g: float
    h: float
    f: float


class TraceOut(BaseModel):
    events: list[TraceEventOut]
    truncated: bool

    @classmethod
    def of(cls, tracer: RecordingTracer) -> "TraceOut":
        return cls(
            events=[
                TraceEventOut(kind=e.kind, cell=e.cell, parent=e.parent, g=e.g, h=e.h, f=e.f)
                for e in tracer.events
            ],
            truncated=tracer.truncated,
        )


class RouteResponse(BaseModel):
    status: Literal["ok", "pose_in_collision", "snap_failed", "unreachable"]
    message: str
    raw_points: list[PointOut]
    smoothed_points: list[PointOut]
    length_raw: float | None
    length_smoothed: float | None
    search: SearchStatsOut | None
    timing: TimingOut | None
    trace: TraceOut | None
    start_cell: tuple[int, int] | None = Field(description="Grid cell (column, row) of the start")
    goal_cell: tuple[int, int] | None
    grid_path: list[tuple[int, int]] = Field(description="Cells of the grid path; empty if none")

    @classmethod
    def of(
        cls, route: RouteResult, timing: PathTiming | None, tracer: RecordingTracer | None
    ) -> "RouteResponse":
        finite = route.length_raw != float("inf")
        return cls(
            status=route.status.value,
            message=route.message,
            raw_points=route.raw_points,
            smoothed_points=route.smoothed_points,
            length_raw=route.length_raw if finite else None,
            length_smoothed=route.length_smoothed if finite else None,
            search=SearchStatsOut.of(route.search) if route.search else None,
            timing=TimingOut.of(timing) if timing else None,
            trace=TraceOut.of(tracer) if tracer else None,
            start_cell=route.start_cell,
            goal_cell=route.goal_cell,
            grid_path=route.grid_path,
        )


class LegOut(BaseModel):
    from_node: str
    to_node: str
    seconds: float
    length: float | None
    points: list[PointOut]
    provenance: Literal["modeled", "measured"]
    modeled_seconds: float | None
    turning_seconds: float | None

    @classmethod
    def of(cls, leg: Leg) -> "LegOut":
        return cls(
            from_node=leg.from_node,
            to_node=leg.to_node,
            seconds=leg.seconds,
            length=None if leg.length != leg.length else leg.length,  # NaN → null
            points=leg.points,
            provenance=leg.provenance,
            modeled_seconds=leg.modeled_seconds,
            turning_seconds=leg.timing.rotation if leg.timing else None,
        )


class LegFailureOut(BaseModel):
    from_node: str
    to_node: str
    status: str
    message: str

    @classmethod
    def of(cls, failure: LegFailure) -> "LegFailureOut":
        return cls(
            from_node=failure.from_node,
            to_node=failure.to_node,
            status=failure.status.value,
            message=failure.message,
        )


class MatrixResponse(BaseModel):
    nodes: list[str]
    legs: list[LegOut]
    failures: list[LegFailureOut]


class GridResponse(BaseModel):
    columns: int
    rows: int
    resolution: float
    inflation: float
    free_count: int
    blocked_runs: list[tuple[int, int, int]] = Field(
        description="Blocked cells as (row, first column, run length)"
    )
