# RoboRoute

Strategy optimisation and simulation for student robotics competitions
(FIRST LEGO League Challenge, WRO RoboMission and similar formats).

RoboRoute turns a robot-game strategy into a plan that can be computed, simulated, compared and
explained: collision-free routes, provably optimal mission selection for tractable problem sizes,
Monte Carlo evaluation under uncertainty, and explanations generated from the actual computation.

> **Status:** under active development. The design is in
> [`docs/architecture/phase-0-design.md`](docs/architecture/phase-0-design.md).
> Example scenarios are fictional and labelled as such; RoboRoute does not ship any official
> competition season content.

## Repository layout

| Path | Contents |
| --- | --- |
| `backend/` | Python package `roboroute`: the pure computational `engine` and a thin FastAPI `api` |
| `frontend/` | React + TypeScript single-page app |
| `scenarios/` | Fictional example scenarios (canonical JSON, validated by tests) |
| `docs/` | Design, mathematics, algorithms, experiments, plans |
| `scripts/` | Repository-level checks |

## Development

Requirements: Python ≥ 3.12 with [uv](https://docs.astral.sh/uv/), Node ≥ 22 with pnpm.

```bash
cd backend && uv sync
```

```bash
cd backend && uv run uvicorn roboroute.api.app:app --reload --port 8000
```

```bash
cd frontend && pnpm install && pnpm dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the backend on port 8000.

### Checks

| Command (run in) | What it does |
| --- | --- |
| `uv run pytest` (`backend/`) | Unit, property-based and API integration tests |
| `uv run ruff check . && uv run ruff format --check .` (`backend/`) | Lint and formatting |
| `uv run mypy src tests scripts` (`backend/`) | Strict type checking |
| `pnpm test` (`frontend/`) | Vitest unit and component tests |
| `pnpm lint && pnpm typecheck && pnpm format:check` (`frontend/`) | ESLint, TypeScript, Prettier |
| `./scripts/check-api-types.sh` (repo root) | Regenerates OpenAPI + TypeScript types and fails if they are stale |

After changing a Pydantic model, regenerate the client types with `./scripts/check-api-types.sh`
and commit the result. After changing an example scenario, run
`uv run python scripts/canonicalize_scenarios.py` in `backend/`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `ROBOROUTE_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed browser origins |
| `ROBOROUTE_EXAMPLES_DIR` | `<repo>/scenarios` | Directory of example scenarios served by the API |
| `ROBOROUTE_MAX_BODY_BYTES` | `1000000` | Maximum request body size |
| `VITE_API_BASE` (frontend build) | page origin | API origin if the API is served elsewhere |

## Licence

MIT — see [LICENSE](LICENSE).
