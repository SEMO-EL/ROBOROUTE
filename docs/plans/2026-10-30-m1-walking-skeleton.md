# M1 — Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running, tested backend + frontend pair: validated domain models, a fictional demo
scenario served by the API, and a read-only arena viewer with correct zoom/pan transforms.

**Architecture:** `backend/` is a uv-managed `src/roboroute` package with a pure `engine` and a thin
FastAPI `api`. `frontend/` is a Vite + React SPA whose API types are generated from the backend's
OpenAPI schema.

**Tech Stack:** Python 3.13 (floor 3.12), FastAPI, Pydantic 2, NumPy, pytest, Hypothesis, ruff,
mypy · React 19, TypeScript 6.0.x, Vite 8, Tailwind 4, Zustand, React Router, Vitest, fast-check.

**Spec:** `docs/architecture/phase-0-design.md`

## Global Constraints
- Internal units SI (m, s, rad); heading CCW from +x, normalised to (−π, π].
- `roboroute.engine` must not import fastapi, starlette, uvicorn or roboroute.api.
- All API/domain models: `extra="forbid"`, explicit numeric bounds.
- No placeholder UI: the navigation shows only pages that work.
- Demo scenarios are fictional and carry `"fictional": true`.
- TypeScript pinned to `~6.0.3`.

## Review Focus
1. Scenario JSON with a constraint/scoring rule referencing a non-existent mission → 422 naming the id
   (Task 3 test `test_unknown_mission_reference_rejected`).
2. Duplicate ids across missions or obstacles → rejected with the duplicate named
   (Task 3 `test_duplicate_ids_rejected`).
3. Zooming repeatedly about the cursor must keep the point under the cursor fixed and never produce
   zoom ≤ 0 or NaN (Task 8 property `zoomAt keeps anchor fixed` + clamp test).
4. Malformed JSON body / wrong types → structured error without stack trace (Task 5
   `test_malformed_json_returns_structured_error`).
5. Backend unreachable → the UI shows an explicit error state, not a blank page (Task 9
   `shows error when examples fail to load`).

---

### Task 1: Repository bootstrap
**Files:** Create `.gitignore`, `LICENSE` (MIT), `README.md` (stub: purpose, status, layout),
`.editorconfig`.
- [ ] Write files; commit `chore: bootstrap repository`.

### Task 2: Backend scaffold, conventions, engine boundary
**Files:** Create `backend/pyproject.toml`, `backend/.python-version` (3.13),
`backend/src/roboroute/{__init__.py,engine/__init__.py,engine/units.py,api/__init__.py}`,
`backend/tests/unit/test_units.py`, `backend/tests/unit/test_engine_boundary.py`.

**Interfaces — Produces:** `roboroute.__version__: str`;
`engine.units.normalize_angle(theta: float) -> float` (result in (−π, π]);
`engine.units.angle_difference(a: float, b: float) -> float` (signed shortest b−a in (−π, π]);
`deg_to_rad`, `rad_to_deg`, `cm_to_m`, `m_to_cm`.

- [ ] Tests: `normalize_angle(3π) == π`, `normalize_angle(-π) == π`, `angle_difference(0.1, -0.1) ≈ -0.2`,
  Hypothesis: result always in (−π, π] and `cos/sin` preserved.
- [ ] Boundary test: walk `roboroute/engine/**/*.py` with `ast`, fail on imports of forbidden modules.
- [ ] Implement; `uv run pytest`, `uv run ruff check`, `uv run mypy src` all pass; commit.

### Task 3: Domain models v1
**Files:** Create `backend/src/roboroute/engine/models/{__init__,base,geometry,arena,robot,distributions,missions,constraints,scoring,competition,scenario}.py`;
tests `backend/tests/unit/models/test_*.py`, `backend/tests/property/test_model_roundtrip.py`.

**Interfaces — Produces** (all `StrictModel` = `BaseModel` with `extra="forbid"`, `frozen=True`):
- `Identifier = Annotated[str, pattern r"^[A-Za-z0-9_-]{1,64}$"]`
- `Pose(x, y, theta)`; `RectShape(kind="rect", cx, cy, width, height, rotation=0)`;
  `CircleShape(kind="circle", cx, cy, radius)`; `Shape` discriminated on `kind`.
- `Obstacle(id, label, kind: "solid"|"no_go", shape)`; `Zone(id, label, shape: RectShape)`;
  `Arena(width, height, grid_resolution, obstacles, home_zones, start_pose)`.
- `MotionProfile(max_speed > 0, acceleration: float | None, provenance: "calibrated"|"entered"|"reference")`;
  `Robot(name, length, width, safety_margin ≥ 0, linear: MotionProfile, angular: MotionProfile)`
  with property `footprint_radius = ½√(L²+W²) + margin`.
- Distributions: `Fixed(value)`, `Triangular(low ≤ mode ≤ high)`, `LogNormal(median > 0, gsd ≥ 1)`,
  `Empirical(samples, 1..10000 items)`; union `Distribution` on `kind`; each has `mean() -> float`.
- `ProbabilitySuccess(p ∈ [0,1])`, `CountsSuccess(successes ≤ attempts, attempts ≥ 1)`;
  `point_estimate()` — probability as given; counts → posterior mean `(s+1)/(n+2)` (uniform prior,
  documented: finite practice never implies certainty).
- `Mission(id, name, description="", approach_pose, execution_time: Distribution, success,
  max_attempts ∈ [1,10] = 1, retry_time: Distribution | None, attachment: str | None)`.
- Constraints: `Requires(before, after, semantics: "attempted"|"succeeded" = "succeeded")`,
  `Precedes(before, after)`, `Excludes(a, b)`; union on `kind`.
- Scoring: `MissionPoints(mission, points)`, `AllOfBonus(missions ≥ 2, points)`,
  `FailurePenalty(mission, points ≥ 0)`; `ScoringProfile(id, name, rules)`.
- `CompetitionFormat(kind: "single_run"|"multi_run", time_budget ∈ (0, 600], reset_time ≥ 0 = 0,
  must_end_in_home: bool = False)`.
- `Scenario(schema_version: Literal[1], id, name, description, fictional: bool, arena, robot,
  missions ≤ 32, constraints, scoring, format)` with `model_validator` checks: unique ids
  (missions, obstacles, zones); every constraint/scoring reference exists; no self-constraints;
  approach poses and start pose inside the arena.

- [ ] Tests (one file per module) including Review Focus items 1–2 and: triangular with mode outside
  [low, high] rejected; counts 10/10 → 11/12; footprint radius of 0.20 × 0.15, margin 0 → 0.125.
- [ ] Property test: Hypothesis strategy builds valid scenarios; `Scenario.model_validate_json(s.model_dump_json()) == s`.
- [ ] Implement; full backend checks pass; commit.

### Task 4: Demo scenario A
**Files:** Create `scenarios/a-simple-arena.json` (fictional: 2.0 × 1.2 m, 3 missions, 4 obstacles,
1 home zone, single_run, 120 s), `backend/src/roboroute/engine/scenarios.py`,
`backend/tests/unit/test_scenarios.py`.

**Interfaces — Produces:** `load_scenario(path: Path) -> Scenario`;
`list_example_scenarios(directory: Path) -> list[Scenario]` (sorted by id).

- [ ] Test: every file in `scenarios/` validates and has `fictional == True`.
- [ ] Implement; commit.

### Task 5: FastAPI application
**Files:** Create `backend/src/roboroute/api/{app.py,errors.py,settings.py,routes/meta.py,routes/examples.py,routes/scenarios.py}`,
`backend/tests/integration/test_api_*.py`, `backend/scripts/export_openapi.py`.

**Interfaces — Produces** (prefix `/api/v1`):
- `GET /health` → `{"status": "ok"}`; `GET /version` → `{"version", "python", "numpy"}`.
- `GET /examples` → `list[ExampleSummary(id, name, description)]`; `GET /examples/{id}` → `Scenario`
  (404 `{"code": "not_found"}`).
- `POST /scenarios/validate` (body: raw JSON) → `ValidationReport(valid: bool, issues: list[Issue(code, message, path)])`
  — always 200 so the editor can display issues.
- Error envelope for all other failures: `{"code", "message", "details"}`; 422 for request
  validation; 413 for bodies > 1 MB; 500 → generic message, logged server-side.
- `create_app(settings: Settings) -> FastAPI`; CORS allow-list from `ROBOROUTE_CORS_ORIGINS`.

- [ ] Tests: health/version; examples list contains `a-simple-arena`; unknown example → 404 envelope;
  validate on a broken scenario lists the unknown-reference issue; Review Focus 4.
- [ ] Implement; commit.

### Task 6: Frontend scaffold and app shell
**Files:** `frontend/{package.json,vite.config.ts,tsconfig*.json,eslint.config.js,.prettierrc,index.html}`,
`frontend/src/{main.tsx,index.css,app/App.tsx,app/routes.tsx,app/Shell.tsx,app/Sidebar.tsx}`,
`frontend/src/app/Shell.test.tsx`.

- [ ] Tailwind 4 theme tokens in `index.css` (near-black navy surfaces, one accent, mono font for
  numbers); Inter + JetBrains Mono via `@fontsource`.
- [ ] Shell: left sidebar (only implemented pages), main workspace, right properties panel slot,
  status bar showing backend connection state.
- [ ] Test: sidebar renders Overview and Arena links only. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass; commit.

### Task 7: Generated API types and client
**Files:** `frontend/src/lib/api/{schema.d.ts (generated),client.ts}`, `frontend/package.json` script
`gen:api`, `scripts/check-api-types.sh`.
- [ ] `client.ts` wraps `openapi-fetch` with base URL `import.meta.env.VITE_API_BASE ?? "/api/v1"`
  and converts the error envelope into `ApiError(code, message, details)`.
- [ ] Vite dev proxy `/api` → `http://localhost:8000`.
- [ ] Check script regenerates types and fails on diff; commit.

### Task 8: Viewport transforms
**Files:** `frontend/src/lib/geometry/viewport.ts`, `frontend/src/lib/geometry/viewport.test.ts`.

**Interfaces — Produces:** `type Viewport = { zoom: number; panX: number; panY: number }` (zoom in
px/m, pan = screen position of arena origin); `arenaToScreen(vp, p)`, `screenToArena(vp, s)`,
`zoomAt(vp, anchor, factor, limits)`, `fitArena(arenaW, arenaH, viewW, viewH, padding)`,
`arenaToCell(p, h)`, `cellCenter(cell, h)`.

- [ ] Property tests (fast-check): round trip `screenToArena(arenaToScreen(p)) ≈ p`; `zoomAt` keeps
  `screenToArena(anchor)` fixed; zoom stays within limits; `fitArena` centres the arena; cell centre
  maps back to the same cell.
- [ ] Implement; commit.

### Task 9: Read-only arena viewer + overview
**Files:** `frontend/src/features/arena/{ArenaCanvas.tsx,ArenaLayers.tsx,useViewport.ts,ArenaPage.tsx}`,
`frontend/src/features/overview/OverviewPage.tsx`, `frontend/src/stores/project.ts`, tests.
- [ ] Store: `useProjectStore` holds `scenario: Scenario | null`, `loadExample(id)`.
- [ ] Viewer: SVG layers (field boundary, grid lines toggle, obstacles, no-go zones, home zones,
  start pose, mission approach poses with heading arrows and labels); wheel zoom about cursor,
  drag pan, "fit" button; cursor coordinate readout in cm (mono font).
- [ ] Overview: example picker, scenario summary (dimensions, mission count, format, time budget),
  "fictional scenario" badge; explicit error and loading states.
- [ ] Tests: renders mission labels for scenario A; Review Focus 5. Commit.

### Task 10: CI and developer docs
**Files:** `.github/workflows/ci.yml`, `README.md` (dev setup, commands).
- [ ] Jobs: backend (ruff check, ruff format --check, mypy, pytest), frontend (lint, format check,
  typecheck, test, build), contract (export OpenAPI, regenerate types, `git diff --exit-code`).
- [ ] Run every job's commands locally; commit.
