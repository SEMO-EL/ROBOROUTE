# RoboRoute — Phase 0 Design

Status: **approved** (2026-10-30). This document records the architecture, the mathematical model and
the decisions that every later milestone builds on. If the implementation and this document disagree,
one of them is wrong and must be fixed — do not let them drift.

---

## 1. Intent

RoboRoute helps students in robotics competitions (FIRST LEGO League Challenge, World Robot Olympiad
RoboMission, and similar formats) turn an intuitive robot-game strategy into a plan that can be
**computed, simulated, compared and explained**.

**Audience (decided):** any student or FLL / WRO participant. Most users are minors, use school
computers, and do not have an instrumented robot. Consequences:

- No accounts and no personal data. Projects live in the user's browser and in files they export.
- Everything must work without an API key and without lab equipment.
- Robot parameters come from a *calibration workflow* using a ruler and a stopwatch, not from
  manufacturer data (see §6).

### Goals
1. Model an arena, missions, constraints, scoring rules and a robot.
2. Compute collision-free routes and realistic travel times.
3. Find provably optimal mission plans under a time budget (for tractable sizes) and compare them to
   a greedy baseline.
4. Evaluate plans under uncertainty with reproducible Monte Carlo simulation.
5. Explain every result from the actual computation, never from generated text.

### Non-goals (v1)
- Adaptive policies (MDP), multi-robot coordination, reinforcement learning, computer vision,
  telemetry, accounts, collaborative editing, LLM features.

### Anti-goals (failure even if it "works")
- Showing a number without saying whether it is *modeled*, *measured* or *simulated*.
- Claiming optimality where the algorithm or the model does not support it.
- Fabricated benchmark results, fabricated competition rules, copied official season content.
- An attractive UI on top of an engine that has not been validated against an independent oracle.

---

## 2. Research findings that shaped the design

Sources were checked on 2026-10-30. Season-specific details must always be re-checked by users;
RoboRoute never hard-codes a season's rules.

| Fact | Source | Design consequence |
|---|---|---|
| FLL Challenge match lasts 2.5 minutes. Home is split into two areas, each with a launch area. Technicians may handle the robot only when it is completely in home. Interrupting the robot outside home costs a *precision token*; the robot is relaunched from home. If the team does not plan to launch again it may stop the robot in place without penalty. | FLL Challenge SUBMERGED Robot Game Rulebook (2024-25), rules 12–19, 22 | Strategies are **lists of runs**. Each run launches from a launch area and returns to home, where attachments can be changed (reset time). The final run may end anywhere. Interruptions are a configurable penalty. |
| WRO RoboMission: one robot attempt of 2 minutes, one press of the start button, the attempt ends if any team member touches the robot. Scoring is based on the field state when the attempt ends. Ties are broken by recorded time. | WRO RoboMission General Rules 2026 (version 15 Jan 2026), rules 10.1, 10.5, 10.7, 10.8, 10.13 | **Single-run** format with no resets. Secondary objective "minimise completion time" is *meaningful* in WRO (lexicographic: score first, then time). |
| SPIKE Prime Large Angular Motor: 175 RPM ±15 % no-load, 135 RPM ±15 % at maximum efficiency (7.2 V). Medium Angular Motor: 185 RPM ±15 % no-load, 135 RPM ±15 % at maximum efficiency. | LEGO Education technical fact sheets 45602, 45603 | Manufacturer data gives only an **upper bound** (no load, nominal voltage, 100 % power). Actual driving speed depends on load, battery, power setting and the team's own motion code. Calibration from measurements is the primary input; specs are shown only as a labeled sanity-check ceiling. |
| EV3 Large Motor: 160–170 RPM. | Secondary sources quoting the 2013 LEGO product sheet (no current primary source found) | Shown as "secondary source" only. |

---

## 3. Architecture

A modular monolith with a pure computational core.

```
React SPA (Vite) ── HTTP/JSON, types generated from OpenAPI ──▶ FastAPI app  (roboroute.api)
  editor · forms · charts · trace replay                          validation · limits · error mapping
  local-first storage (IndexedDB) + JSON/CSV files                stateless: no database
                                                                    │
                                     roboroute.engine — pure Python, deterministic, no web imports
                 geometry → grid → pathfinding → motion → travel matrix
                 calibration · missions/validation · scoring → optimization → simulation → stats
```

### Decisions
- **Engine is a library.** Validated Pydantic models in, result models out. No I/O, no global state.
  An automated test fails if `roboroute.engine` imports `fastapi`, `starlette`, `uvicorn` or
  `roboroute.api`.
- **Stateless backend, local-first storage (my call, driven by the audience).** Projects and
  experiments are stored in the browser (IndexedDB) and exported/imported as versioned JSON. The
  backend stores nothing. This avoids holding minors' data, needs no accounts, scales trivially, and
  lets a classroom use a deployed instance safely. The frontend talks to storage through a
  `ProjectRepository` interface, so a server-backed implementation (SQLAlchemy → SQLite/Postgres)
  can be added later without touching features. *This replaces the spec's SQLite requirement for v1.*
- **Reproducibility over storage.** Simulation results are deterministic given (inputs, seed, engine
  version, NumPy version). Raw per-trial rows can therefore be regenerated for CSV export instead of
  stored.
- **One source of truth for types.** Pydantic → OpenAPI → `openapi-typescript`. CI fails if the
  committed TypeScript types are stale.
- **Synchronous compute endpoints first.** A job model (submit / poll / cancel, process pool) is added
  only if measured request times justify it. Requests are bounded by explicit limits (§9).
- **Rendering:** SVG for interactive arena objects; a Canvas layer beneath it for dense data
  (grid cells, A* exploration).
- **Educational traces:** algorithms accept an optional `tracer`. The same code path produces the
  result and the trace, so explanations cannot drift from the computation.
- **Deployment:** one container — FastAPI serves the built SPA. Docker only for deployment.

---

## 4. Repository layout

```
ROBOROUTE/
├── backend/
│   ├── pyproject.toml                 # uv; ruff, mypy, pytest config
│   ├── src/roboroute/
│   │   ├── engine/
│   │   │   ├── models/                # Pydantic domain contracts (the schema)
│   │   │   ├── units.py               # conventions, angle normalisation
│   │   │   ├── geometry/              # primitives, distances, clearance, collision
│   │   │   ├── grid/                  # occupancy rasterisation
│   │   │   ├── pathfinding/           # dijkstra, astar, heuristics, smoothing
│   │   │   ├── motion/                # trapezoidal profiles, path timing
│   │   │   ├── calibration/           # parameter fitting from measurements
│   │   │   ├── travel/                # travel-time matrix + provenance
│   │   │   ├── missions/              # constraint validation
│   │   │   ├── scoring/               # expected value, exact distributions
│   │   │   ├── optimization/          # compiled instance, brute force, greedy, DP, explain
│   │   │   ├── simulation/            # distributions, RNG streams, trial runner
│   │   │   ├── stats/                 # summaries, confidence intervals, histograms
│   │   │   └── trace.py
│   │   └── api/                       # FastAPI routers, error mapping, limits
│   └── tests/{unit,property,integration}/
├── frontend/src/
│   ├── app/                           # shell, routing, layout
│   ├── features/{arena,missions,robot,optimizer,simulation,analytics,experiments,learn}/
│   ├── lib/{geometry,api,format,storage}/
│   ├── components/ui/
│   └── stores/
├── scenarios/                         # versioned JSON, fictional demo scenarios
├── experiments/<id>/                  # benchmark code + raw results + figures
└── docs/{architecture,mathematics,algorithms,experiments,user-guide,api}/
```

---

## 5. Conventions (ADR-001)

- **Internal units are SI:** metres, seconds, radians. The UI displays centimetres and degrees by
  default and converts only at the UI boundary.
- **Arena frame:** origin at the bottom-left corner of the playing field; $+x$ to the right along the
  long edge; $+y$ towards the far wall.
- **Heading** $\theta$ is measured counter-clockwise from $+x$ and normalised to $(-\pi, \pi]$.
- **Screen frame (SVG):** $+y$ points down. With zoom $k$ (pixels per metre) and pan offset
  $(p_x, p_y)$ (screen position of the arena origin):
  $s_x = p_x + k\,x$, $s_y = p_y - k\,y$; inverse $x = (s_x - p_x)/k$, $y = (p_y - s_y)/k$.
  Zooming about a cursor keeps the arena point under the cursor fixed.
- **Grid frame:** cell $(i, j)$ = (column, row) covers $[i h, (i+1)h) \times [j h, (j+1)h)$; its centre
  is $((i+\tfrac12)h, (j+\tfrac12)h)$.

---

## 6. Robot model and calibration

### 6.1 Motion model (v1)
The robot drives **straight segments** and makes **point turns** between them (how most FLL/WRO
robots are programmed: "drive 30 cm, turn 90°"). Each segment starts and ends at rest with a
symmetric trapezoidal velocity profile (max speed $v$, acceleration $a$):

$$
t(d) = \begin{cases} \dfrac{d}{v} + \dfrac{v}{a} & d \ge \dfrac{v^2}{a} \\[6pt] 2\sqrt{d/a} & d < \dfrac{v^2}{a} \end{cases}
$$

Rotation uses the same formula with $(\omega, \alpha)$. Path time:
$T = \sum_k t(\ell_k) + \sum_k t_{rot}(|\Delta\theta_k|)$ including the final turn to the required
heading. Constant-speed is the special case $a \to \infty$.

Differential-drive kinematics (documented, used for future curved motion):
$v = (v_R + v_L)/2$, $\omega = (v_R - v_L)/b$; for a point turn $\omega_{max} = 2 v_{wheel}/b$.
Minimum turning radius is not a parameter: a differential drive turns in place.

### 6.2 Calibration (primary source of parameters)
The user drives the robot a few known distances at their usual power setting and times each one
(phone stopwatch or the hub timer). Because $t(d) = d \cdot \tfrac1v + \tfrac{v}{a}$ in the
trapezoidal regime, time is **linear in distance**:

- slope $= 1/v$ → effective top speed $v$;
- intercept $c = v/a$ → acceleration $a = v / c$.

With one measurement only the average speed $\bar v = d/t$ is identifiable; RoboRoute then uses a
constant-speed model and says so. With ≥ 2 distinct distances it fits $(v, a)$ by least squares,
reports residuals and $R^2$, and checks the regime assumption ($d_i \ge v^2/a$ for all points).
The same procedure calibrates turning from timed turns of known angle.

Example (illustrative, not a reference value): if 20 cm takes 1.2 s and 100 cm takes 3.6 s, then
$v = 0.8\,\text{m} / 2.4\,\text{s} = 0.333$ m/s, $c = 1.2 - 0.2/0.333 = 0.6$ s, $a = 0.556$ m/s².

Every robot parameter carries a provenance: `calibrated` (with its measurements), `entered`
(typed by the user) or `reference` (manufacturer ceiling, clearly labeled).

### 6.3 Footprint and configuration space
The robot is a $L \times W$ rectangle. v1 plans with the circumscribed disc
$R = \tfrac12\sqrt{L^2 + W^2} + m$ (safety margin $m$). A centre point $p$ is free iff its
**clearance** $c(p) = \min(\text{dist}(p, \text{obstacles}), \text{dist}(p, \text{arena boundary}))
\ge R$. This is conservative: a 20 × 15 cm robot has $R = 12.5$ cm versus a half-width of 7.5 cm.

**Grid safety theorem.** Clearance is 1-Lipschitz ($|c(p) - c(q)| \le \|p - q\|$). A grid cell is
marked free iff $c(\text{centre}) \ge R + \delta$ with $\delta = h\sqrt2/2$. Any segment between
two 8-adjacent free centres has length $\le h\sqrt2$, so every point on it is within $\delta$ of an
endpoint and therefore has clearance $\ge R$. **Grid paths are collision-free in continuous space.**

**Missions sit next to obstacles by definition.** Each mission has an *approach pose* $(x, y, \theta)$
that must be collision-free; the contact manoeuvre is part of the mission's execution time.

---

## 7. Pathfinding

- Graph: free grid cells; 4- or 8-connectivity; edge cost = Euclidean length ($h$ or $h\sqrt2$).
  Diagonal moves are allowed only if both adjacent orthogonal cells are free (no corner cutting).
- **Dijkstra** (binary heap, lazy deletion), **A\*** with heuristics:
  - Manhattan — admissible only for 4-connectivity;
  - Octile — tightest admissible and consistent heuristic for 8-connectivity;
  - Euclidean — admissible for both, weaker than octile on 8-connected grids.
  Using Manhattan on an 8-connected grid is allowed for experiments but flagged "not admissible:
  optimality not guaranteed".
- **Smoothing:** greedy line-of-sight shortcutting using the exact continuous clearance check;
  never longer than the input path, never introduces a collision.
- **Travel matrix:** for each pair of nodes (start, home areas, mission approach poses): path →
  smoothing → time with the motion model, including turning from the source heading and to the
  target heading. Any entry can be overridden by a measured time (provenance `measured`).
- Shortest is not fastest: a time-optimal planner needs heading in the search state $(x, y, \theta)$.
  This is a documented stretch goal.

---

## 8. Strategy optimisation

### 8.1 Planning model (deterministic, exact)
- Nodes: $0$ = home, $1..n$ = missions; travel times $\tau_{ij}$ from the travel matrix.
- Mission $i$: planning duration $d_i$ (mean of the execution distribution by default; worst case of
  $m_i$ attempts if retries are budgeted: $d_i = e_i + (m_i - 1) e_i^{retry}$).
- Per-attempt success $p_i$; eventual success $P_i = 1 - (1 - p_i)^{m_i}$.
- Constraints: `requires(a → b)` (b only after a; semantics *attempted* or *succeeded*),
  `precedes(a, b)` (if both are chosen, a first), `excludes(a, b)` (not both).
- Format: `multi_run` (FLL-like: return to home costs travel + reset time $c$; the last run may end
  anywhere) or `single_run` (WRO-like: no returns).

Let $A(i)$ be $i$ plus all transitive *succeeded*-type prerequisites. With independent outcomes:

$$
E[\text{score} \mid S] = \sum_{i \in S} r_i \prod_{k \in A(i)} P_k \;+\; \text{bonus and penalty terms built the same way.}
$$

**Key property:** in the planning model the expected score depends only on the *set* $S$; only the
time depends on the order. Optimisation therefore separates into "which sets are feasible?" and
"which feasible set is best?".

### 8.2 Bitmask dynamic programming
$C(S, j)$ = minimum time to complete exactly the missions in $S$ and be at node $j$:

$$
\begin{aligned}
C(\varnothing, 0) &= 0\\
C(S \cup \{k\}, k) &= \min_j \; C(S, j) + \tau_{jk} + d_k \quad k \notin S,\ \text{pre}(k) \subseteq S,\ k \text{ not excluded by } S\\
C(S, 0) &= \min_{j \in S} \; C(S, j) + \tau_{j0} + c \quad \text{(multi-run only: return home)}
\end{aligned}
$$

$S$ is feasible iff $\min_j C(S, j) + \text{end}(j) \le B$, where $\text{end}(j)$ is $\tau_{j0}$ if the
format requires finishing in home and $0$ otherwise.

Correctness rests on the **Markov property**: the cost of continuing depends only on $(S, j)$.
Complexity $O(2^n n^2)$ time, $O(2^n n)$ memory. Brute force over all orderings
($\lfloor e \cdot n! \rfloor$ sequences) is the independent oracle for $n \le 7$.

Because the DP returns the feasible family of sets, **every set-function objective is optimised
exactly** over the same family: $E[\text{score}]$, $\text{Var}[\text{score}]$,
$P(\text{score} \ge \tau)$, slack. Trade-offs are shown as a Pareto front — never a weighted sum.
WRO tie-break is lexicographic: maximise score, then minimise time.

### 8.3 Greedy baseline
Repeatedly append the feasible mission with the highest $\Delta E / \Delta t$. Not optimal:
with $B = 100$ s, X = 10 pts / 10 s and Y = 90 pts / 95 s, greedy takes X (ratio 1.0) and can no
longer fit Y (10 points); the optimum is Y alone (90 points).

### 8.4 Explanations (computed, never generated)
- Time breakdown per leg (travel, turning, execution, reset) and slack $B - T$.
- For each excluded mission: the best value with that mission **forced in**, and the loss versus the
  optimum (or "infeasible", with the binding constraint).
- For each selected mission: the loss if it is **forced out**.
- Speed sensitivity: re-optimise with speeds scaled, report where the optimal plan changes.

---

## 9. Simulation

### 9.1 Evaluation model
Monte Carlo over the plan with random durations, a hard time limit $B$, and documented
**contingency rules** shared with the optimiser:
1. Skip a mission whose *succeeded*-type prerequisite failed.
2. Retry a failed attempt up to $m_i$ attempts in total.
3. (optional) Skip a mission when the remaining time is less than its planning time plus the trip to
   the end point.
4. A mission still in progress at the time limit scores nothing (assumption: competitions score the
   final field state).

It is a sequential event-trace simulator (one robot, no concurrency); a full event-queue scheduler
would add nothing until multi-robot support exists.

### 9.2 Distributions
`Fixed`, `Triangular(min, mode, max)` (default for user estimates), `LogNormal(median, gsd)` (for
fitted data), `Empirical(samples)`. Normal distributions are not offered as defaults because they
produce negative durations. Success: Bernoulli. Success probability can be entered as counts
(successes / attempts); the UI shows the Wilson interval to make small-sample uncertainty visible
(8/10 → 95 % CI ≈ [0.49, 0.94]).

### 9.3 Randomness and reproducibility
`numpy.random.Generator(PCG64)` seeded through `SeedSequence`; independent child streams per random
variable type so adding a variable does not shift the others. **Common random numbers** when
comparing plans. Results record seed, engine version, NumPy version and an input hash (NumPy only
guarantees bit-generator stream stability, not distribution-method stability, across versions).

### 9.4 Statistics
Mean with normal-approximation CI; proportions with Wilson intervals; percentiles (median, p90, p95)
with bootstrap CIs; histograms and ECDFs computed in the engine.

### 9.5 Bridging the two models
- The DP produces top-K candidate plans; Monte Carlo re-ranks them using common random numbers.
- **Validation identity:** with `Fixed` durations, the Monte Carlo mean must converge to the DP's
  analytic $E[\text{score}]$. This cross-checks two independently written components.

---

## 10. Scoring

Scoring profiles are stored separately from missions and are **declarative only** (no user
expressions, so no code execution and expectations stay computable):

- `MissionPoints(mission, points)` — awarded when the mission succeeds.
- `AllOfBonus(missions[], points)` — awarded when all listed missions succeed.
- `FailurePenalty(mission, points)` — applied when an attempted mission ends failed.
- `InterruptionPenalty(table)` — points as a function of the number of interruptions
  (season-specific; the user enters it).

---

## 11. Limits and security

- Every API input is a Pydantic model with `extra="forbid"` and explicit numeric bounds.
- Request limits (initial values, revisited after measurement): body ≤ 1 MB; grid ≤ 400 000 cells;
  exact optimisation $n \le 16$ missions; brute force $n \le 8$; Monte Carlo ≤ 50 000 trials.
- Errors are mapped to structured JSON (`code`, `message`, `details`); no stack traces leak.
- JSON import is validated against the versioned schema; unknown versions are rejected with a clear
  message; migrations are pure functions.
- CSV export prefixes cells that start with `=`, `+`, `-`, `@`, tab or carriage return (formula
  injection).

---

## 12. Testing strategy

1. Unit tests for every module (pytest, Vitest).
2. Property-based tests (Hypothesis, fast-check): transform round trips; A* cost = Dijkstra cost =
   NetworkX cost; all paths collision-free; smoothing never lengthens or collides; greedy ≤ DP =
   brute force on random instances.
3. Monotonicity / metamorphic tests: larger budget never lowers the optimum; scaling speed scales
   time; mirroring the arena preserves lengths; relabelling missions preserves the optimum.
4. Simulation validation against analytic values with **fixed seeds and tolerances derived from the
   standard error**, never tuned to pass.
5. Edge-case scenario fixtures: no missions, one mission, unreachable mission, blocked arena,
   budget too small, $p = 0$, $p = 1$, cycles, contradictions.
6. API integration tests; contract test (generated types up to date); Playwright end-to-end tests.
7. Engine boundary test.

Benchmarks live in `experiments/<id>/` and write raw CSV + `metadata.json` (git SHA, CPU, versions,
seeds). Wall-clock timings are reported with expanded-node counts (implementation-independent).

---

## 13. Milestones

| # | Milestone | Exit criteria |
|---|---|---|
| M0 | This design | Approved |
| M1 | Walking skeleton: backend + frontend + CI, domain models, Scenario A, read-only arena viewer | CI green, transforms property-tested |
| M2 | Geometry, pathfinding, motion, calibration, travel matrix; experiments 1 and 6 | Oracle + property tests |
| M3 | Validation, brute force, greedy, DP (multi-run), Pareto, explanations; experiments 2 and 4 | DP = brute force on random instances |
| M4 | Monte Carlo, statistics, CRN comparison, re-ranking; experiments 3 and 5 | Analytic agreement tests |
| M5 | Arena editor, mission manager, robot configuration + calibration UI | E2E: build arena → optimise |
| M6 | Analytics, comparison, local-first experiments, JSON/CSV export | Save → reload → identical rerun |
| M7 | Educational mode (A*, DP, Monte Carlo) | Traces replay to identical results |
| M8 | Hardening, accessibility, deployment config, documentation | Full regression green |

---

## 14. Calls made without explicit user input (please review)

1. Local-first browser storage instead of a server database (audience = minors, public tool).
2. MIT licence.
3. Competition formats are generic (`single_run`, `multi_run`); demo scenarios are fictional and
   labeled as such.
4. TypeScript pinned to 6.0.x because `typescript-eslint` does not yet support TypeScript 7.
5. NetworkX and Shapely are test oracles only; all production algorithms are implemented in the
   engine.
