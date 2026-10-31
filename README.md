# RoboRoute

Strategy planning for student robotics competitions (FIRST LEGO League Challenge, WRO RoboMission
and similar robot games): where the robot can drive, which missions to attempt and in what order,
and how that plan holds up when things go wrong.

- **Routes** around obstacles with A* or Dijkstra on a grid that accounts for the robot's size,
  timed with an acceleration-aware motion model.
- **Calibration from a stopwatch.** Time your robot over two or more distances and RoboRoute fits
  its speed and acceleration. Whole trips you have timed replace the modelled times.
- **The optimal plan** for up to 16 candidate missions (exact dynamic programming, cross-checked
  against brute force), with a greedy baseline and an explanation of every choice computed by
  re-optimising.
- **Monte Carlo simulation** of random durations, failures, retries and a strict buzzer, with
  confidence intervals and fair plan comparisons on common random numbers.
- **Experiments** saved locally, reproducible exactly, exportable as JSON and CSV.
- **Learn mode**, which replays the actual computation step by step: the search, the DP table and
  the convergence of the simulation.

Example scenarios are **fictional** and labelled as such. RoboRoute ships no official competition
content. Everything is stored in your browser; the server keeps nothing.

**Using it:** read the [user guide](docs/user-guide.md).
**How it works:** read the [design](docs/architecture/phase-0-design.md), then the
[algorithms](docs/algorithms/) and [mathematics](docs/mathematics/) notes.
**How well it works:** see the reproducible [experiments](docs/experiments/), which record their
raw data and environment.

## Run it

### With Docker (one container)

```bash
docker build -t roboroute .
```

```bash
docker run --rm -p 8000:8000 roboroute
```

Open <http://localhost:8000>. The container serves the web app and the API, runs as an
unprivileged user, needs no secrets and reports its health at `/api/v1/health`. If Docker Hub
rate-limits the base images, pass a mirror, e.g.
`--build-arg NODE_IMAGE=mirror.gcr.io/library/node:22.22-bookworm-slim --build-arg PYTHON_IMAGE=mirror.gcr.io/library/python:3.13-slim-bookworm`.

### As a public website

- **GitHub Pages** (free, no server): <https://semo-el.github.io/ROBOROUTE/>. The Python engine
  runs in the visitor's browser with [Pyodide](https://pyodide.org) (WebAssembly) in a Web
  Worker, answering the same API through the same FastAPI app. CI builds it with
  `pnpm build:pages` (`frontend/`), runs the end-to-end tests against it and deploys it after
  every check on `main` passes. The first visit downloads about 20 MB (SciPy, 14 MB more, only
  when calibrating); later visits come from the browser cache. One-time setup: repository
  Settings → Pages → Source: **GitHub Actions**.
- **Hugging Face Spaces** (free, no card needed): a GitHub Action publishes `main` to a Space
  after CI passes; see [docs/deploy-huggingface.md](docs/deploy-huggingface.md).
- **Render** (free tier needs a card): `render.yaml` deploys the same container; see
  [docs/deploy-render.md](docs/deploy-render.md).

Both add limits suited to a public site (requests per visitor, calculations at once).

### For development

Requirements: Python ≥ 3.12 with [uv](https://docs.astral.sh/uv/), Node ≥ 22 with pnpm.

```bash
cd backend && uv sync && uv run uvicorn roboroute.api.app:app --reload --port 8000
```

```bash
cd frontend && pnpm install && pnpm dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the backend.

## Verify it

| Command (run in) | What it checks |
| --- | --- |
| `uv run pytest` (`backend/`) | Unit, property-based (Hypothesis, with NetworkX and Shapely as oracles) and API tests |
| `uv run ruff check . && uv run ruff format --check . && uv run mypy src tests scripts` (`backend/`) | Lint, formatting, strict types |
| `pnpm test` (`frontend/`) | Vitest unit and component tests |
| `pnpm lint && pnpm typecheck && pnpm format:check` (`frontend/`) | ESLint, TypeScript, Prettier |
| `pnpm test:e2e` (`frontend/`) | Builds the app and runs Playwright against the backend serving it: the whole student workflow, plus an axe-core WCAG 2.2 AA scan of every page. Needs `uv` and Chromium (`pnpm exec playwright install chromium`) |
| `pnpm test:e2e:pages` (`frontend/`) | The same tests against the GitHub Pages build, with the engine running in the browser (needs `uv` to build the backend wheel) |
| `./scripts/check-api-types.sh` (repo root) | The TypeScript API types match the backend schema |
| `uv run python ../experiments/<id>/run.py`, then `analyze.py` (`backend/`) | Re-runs a benchmark and regenerates its summary and figures (details at the top of each `run.py`; results in `docs/experiments/`) |

CI runs all of these, plus a job that builds the container and checks that it serves the app.

After changing a Pydantic model, regenerate the client types with `./scripts/check-api-types.sh`
and commit the result. After changing an example scenario, run
`uv run python scripts/canonicalize_scenarios.py` in `backend/`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `ROBOROUTE_STATIC_DIR` | unset (API only) | Built web app (`frontend/dist`) to serve alongside the API |
| `ROBOROUTE_EXAMPLES_DIR` | `<repo>/scenarios` | Directory of example scenarios |
| `ROBOROUTE_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins allowed to call the API from elsewhere (empty when served together) |
| `ROBOROUTE_MAX_BODY_BYTES` | `1000000` | Maximum request body size |
| `ROBOROUTE_RATE_LIMIT_PER_MINUTE` | `0` (off) | Heavy calculations (routes, optimise, simulate) allowed per client address per minute |
| `ROBOROUTE_MAX_CONCURRENT_JOBS` | `0` (off) | Heavy calculations running at once; others wait up to 30 s, then get "busy" |
| `ROBOROUTE_FRAME_ANCESTORS` | unset (no framing) | Space-separated sites allowed to show the app in a frame (e.g. `https://huggingface.co`) |
| `PORT` (container) | `8000` | Port the container listens on (set by hosting platforms) |
| `FORWARDED_ALLOW_IPS` (container) | `127.0.0.1` | Proxies trusted for the client address; `*` behind a platform proxy |
| `VITE_API_BASE` (frontend build) | page origin | API origin if the API is hosted separately |

## Security

Every API input is validated with explicit bounds, and computation sizes are limited (see the
[user guide](docs/user-guide.md#limits)). Errors are structured JSON without stack traces.
Responses carry a same-origin Content-Security-Policy and related headers. CSV exports neutralise
cells a spreadsheet could execute. RoboRoute stores no accounts and no user data on the server.

## Repository layout

| Path | Contents |
| --- | --- |
| `backend/` | Python package `roboroute`: the pure computational `engine` and a thin FastAPI `api` |
| `frontend/` | React + TypeScript single-page app; `e2e/` holds the Playwright tests |
| `scenarios/` | Fictional example scenarios (canonical JSON, validated by tests) |
| `experiments/` | Benchmark scripts and their recorded results |
| `docs/` | User guide, design, algorithms, mathematics, experiments, milestone plans |
| `scripts/` | Repository-level checks |

## Licence

MIT — see [LICENSE](LICENSE).
