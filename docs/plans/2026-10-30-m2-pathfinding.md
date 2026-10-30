# M2 — Geometry, Pathfinding, Motion, Calibration, Travel Matrix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collision-free routes between any two poses with Dijkstra and A*, smoothed and timed with
the robot's motion model; a calibration fit for motion parameters; a travel-time matrix; and a
route view in the arena page.

**Architecture:** Pure engine modules (`geometry`, `grid`, `pathfinding`, `motion`, `calibration`,
`travel`) with NumPy for rasterisation only; thin API routes; frontend overlay.

**Spec:** `docs/architecture/phase-0-design.md` §6, §7.

## Global Constraints
- Grid cell (i, j) covers [i·h, (i+1)·h) × [j·h, (j+1)·h); columns = ⌈W/h⌉, rows = ⌈H/h⌉ (canonical;
  the frontend follows it). Index NumPy arrays as `[j, i]`.
- A cell is free iff clearance(centre) ≥ R + h√2/2 (grid safety theorem, design §6.3). Diagonal moves
  between free cells are therefore safe without a corner-cutting rule.
- Clearance is a *signed* distance: negative inside an obstacle or outside the arena.
- Heuristics: Manhattan (admissible only for 4-connectivity), octile, Euclidean, zero. Using a
  non-admissible combination is allowed but the result carries `optimality_guaranteed = False`.
- Every travel-matrix entry carries `provenance` ("modeled" or "measured").

## Review Focus
1. Approach pose inside an obstacle → route reports `pose_in_collision` naming the mission
   (Task 5 `test_pose_in_collision_reported`).
2. Goal enclosed by obstacles → `unreachable`, never an exception or an infinite loop
   (Task 4 `test_unreachable_goal_returns_none`).
3. Start pose not on a cell centre and its own cell blocked at grid resolution → connected via an
   exactly-checked straight segment, or a clear `snap_failed` message (Task 5 `test_snap_*`).
4. Zero-length legs (same pose) → time 0 except heading change (Task 6 `test_zero_length_leg`).
5. Calibration with decreasing times or a single measurement → explicit model choice and warning,
   never NaN (Task 7 `test_calibration_*`).

---

### Task 1: Geometry primitives
**Files:** `engine/geometry/{__init__,primitives}.py`, `tests/unit/geometry/test_primitives.py`,
`tests/property/test_geometry_oracle.py` (Shapely oracle).
**Produces:** `Point = tuple[float, float]`; `point_segment_distance(p, a, b)`;
`segments_intersect(a, b, c, d)`; `segment_segment_distance(a, b, c, d)`;
`signed_distance(p, shape)`; `segment_distance(a, b, shape)` (0 if touching/intersecting, else
≥ 0); shapes are the model `RectShape` / `CircleShape`.
- [ ] Tests: hand cases (rotated rect, point inside → negative, segment through circle → 0) +
  Hypothesis vs Shapely within 1e-9.

### Task 2: Clearance field
**Files:** `engine/geometry/clearance.py`, tests.
**Produces:** `ClearanceField(arena)` with `at(p) -> float`, `segment(a, b) -> float`,
`grid(xs: ndarray, ys: ndarray) -> ndarray` (vectorised, same values as `at`).
- [ ] Tests: boundary term `min(x, W−x, y, H−y)`; segment clearance ≤ endpoint clearances;
  vectorised == scalar on random points; 1-Lipschitz property (Hypothesis).

### Task 3: Occupancy grid
**Files:** `engine/grid/{__init__,occupancy}.py`, tests.
**Produces:** `OccupancyGrid(resolution, columns, rows, free: ndarray[bool])`, `build_grid(arena,
radius) -> OccupancyGrid`, `cell_of(p)`, `center_of(cell)`, `neighbors(cell, connectivity)`
yielding `(cell, cost)`, `blocked_runs() -> list[tuple[int, int, int]]`.
- [ ] Tests: columns/rows = ceil; safety theorem property — every 8-adjacent free pair's segment
  has exact clearance ≥ R (Hypothesis over random arenas).

### Task 4: Dijkstra and A*
**Files:** `engine/pathfinding/{__init__,heuristics,search,trace}.py`, tests incl. NetworkX oracle.
**Produces:** `Heuristic` enum (`manhattan`, `octile`, `euclidean`, `zero`) with
`is_admissible(connectivity)`; `astar(grid, start, goal, heuristic, connectivity, tracer=None) ->
SearchResult(path: list[Cell] | None, cost, expanded, generated, optimality_guaranteed)`;
`dijkstra(grid, source, targets, connectivity) -> ShortestPathTree(dist: dict, parent: dict,
expanded)`; `tree.path_to(cell)`; `Tracer` protocol + `RecordingTracer(max_events)`.
- [ ] Tests: A* cost == Dijkstra cost == NetworkX cost on random grids (admissible heuristics);
  Manhattan + 8-connectivity flagged; unreachable → `path is None`; A* expands ≤ Dijkstra on open
  grids; tracer records expand events with g, h, f.

### Task 5: Route planning between poses
**Files:** `engine/pathfinding/{smoothing,routes}.py`, tests.
**Produces:** `shortcut(points, is_free) -> list[Point]`; `plan_route(scenario, start: Pose, goal:
Pose, options: RouteOptions) -> RouteResult(status, raw_points, smoothed_points, length_raw,
length_smoothed, search stats, message)`; statuses: `ok`, `pose_in_collision`, `snap_failed`,
`unreachable`.
- [ ] Tests: smoothed never longer, every smoothed segment exactly free; Review Focus 1–3.

### Task 6: Motion timing with optional reversing
**Files:** `engine/motion/{__init__,profiles,timing}.py`, model change `Robot.can_reverse: bool =
True`, tests.
**Produces:** `profile_time(distance, profile) -> float`; `time_path(points, start_heading,
end_heading: float | None, robot) -> PathTiming(total, translation, rotation, legs)`; with
`can_reverse` a 2-state DP chooses forward/backward per segment to minimise turning.
- [ ] Tests: trapezoid/triangle formulas incl. boundary d = v²/a; constant speed when a is None;
  reversing out of a dead end is faster than turning 180°; Review Focus 4.

### Task 7: Calibration fit
**Files:** `engine/calibration/{__init__,fit}.py`, `engine/models/calibration.py`, tests.
**Produces:** `Measurement(amount, seconds)`; `fit_profile(measurements) -> CalibrationResult(
max_speed, acceleration | None, model, r_squared, residuals, warnings)` — one point → constant
speed; ≥ 2 distinct amounts → linear fit t = d/v + c, refined by `scipy.optimize.least_squares`
on the exact piecewise model if any point is in the triangular regime.
- [ ] Tests: recovers known (v, a) from synthetic exact data; design-doc example (20 cm 1.2 s,
  100 cm 3.6 s → v = 0.333, a = 0.556); Review Focus 5.

### Task 8: Travel matrix
**Files:** `engine/travel/{__init__,matrix}.py`, model `TravelOverride` + `Scenario.travel_overrides`,
tests.
**Produces:** nodes `start` + mission ids; `build_travel_matrix(scenario, options) ->
TravelMatrix(nodes, legs: dict[(from, to), Leg | None])`; `Leg(seconds, length, points,
provenance, timing)`; overrides replace modeled times with provenance `measured`.
- [ ] Tests: diagonal zero; matches `plan_route` + `time_path` for every pair; override applied;
  unreachable mission → None with reason.

### Task 9: API routes
**Files:** `api/routes/routes.py`, `api/routes/calibration.py`, integration tests, regenerate types.
**Produces:** `POST /routes/plan`, `POST /routes/matrix`, `POST /routes/grid`,
`POST /calibration/fit`.

### Task 10: Route view in the arena page
**Files:** `frontend/src/features/arena/{RoutePanel,RouteLayer,GridLayer}.tsx`, tests.
- [ ] Choose from/to, algorithm, heuristic, connectivity; draw blocked cells (canvas), explored
  cells, raw and smoothed paths; show length, time, expanded nodes, optimality guarantee.

### Task 11: Experiments 1 and 6 + algorithm docs
**Files:** `experiments/{01-astar-vs-dijkstra,06-grid-resolution}/{run,analyze}.py`,
`docs/experiments/*.md`, `docs/algorithms/pathfinding.md`, `docs/mathematics/motion.md`.
- [ ] Run, commit raw CSV + metadata + figures; write up with actual numbers only.
