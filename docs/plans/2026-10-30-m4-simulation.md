# M4 — Monte Carlo Simulation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluate any plan under uncertainty — random durations, random success, a hard buzzer —
with reproducible, statistically honest outputs, and compare plans fairly.

**Spec:** `docs/architecture/phase-0-design.md` §9.

## Global Constraints
- Contingency rules identical to the planning model (design §9.1): skip a mission whose
  "succeeded" requirement failed; retry up to m attempts; optional skip when the remaining time is
  less than the mission's planning duration (+ trip home if required); a mission in progress at
  the buzzer scores nothing and incurs no penalty.
- Travel-time uncertainty: each leg time is multiplied by F ~ LogNormal with mean 1 and
  coefficient of variation `travel_time_cv` (σ² = ln(1 + cv²), μ = −σ²/2).
- RNG: `numpy.random.Generator(PCG64)`; every random variable family has its own stream derived from
  `SeedSequence(seed, spawn_key=(crc32(mission id), kind))` so streams are stable under plan
  changes (common random numbers).
- Trials ≤ 50,000 per plan; ≤ 5 plans per comparison.
- Statistics: mean ± 1.96·s/√n; Wilson intervals for proportions; distribution-free order-statistic
  intervals for quantiles.

## Review Focus
1. A plan referencing an unknown or excluded mission → 422 naming it (Task 5 test).
2. p = 0 requirement → dependent mission never attempted, no travel to it (Task 2 test).
3. Duration longer than the remaining time → mission scores nothing (Task 2 test).
4. trials = 1 → statistics without NaN (intervals degenerate but finite) (Task 3 test).
5. Same seed twice → identical results; different seed → different (Task 2 test).

### Task 1: Distribution sampling and RNG streams — `engine/simulation/{sampling,rng}.py`
### Task 2: Vectorised trial runner — `engine/simulation/runner.py`
`simulate(instance, scenario, plan_runs, config) -> SimulationTrials` (arrays over trials: score,
completion time, cut_off, per-mission success/attempted).
### Task 3: Statistics — `engine/stats/summary.py`
`wilson`, `mean_ci`, `quantile_ci`, `summarize(values)`, `histogram`, `ecdf`.
### Task 4: Analytic validation tests (the identity of design §9.5) and CRN comparison
`compare(instance, scenario, plans, config)` with paired differences.
### Task 5: API `/simulate`, `/simulate/compare`; scenario C (risk-based)
### Task 6: Simulation page (frontend) — stat tiles, score and time distributions, per-mission
rates, analytic-vs-simulated note, optimal-vs-greedy comparison.
### Task 7: Experiments 3 (risk vs reward) and 5 (Monte Carlo convergence) + docs.
