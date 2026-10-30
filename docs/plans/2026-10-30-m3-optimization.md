# M3 — Strategy Optimisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Given a scenario and its travel matrix, find the mission plan (runs, order) with the
highest expected score that fits the time budget — provably optimal for tractable sizes —
compare it with a greedy baseline, and explain the result with exact counterfactuals.

**Spec:** `docs/architecture/phase-0-design.md` §8, §10.

## Global Constraints
- Planning model (design §8.1): deterministic planning durations (mean of the execution
  distribution; with retries, *all* attempts are budgeted: dᵢ = mean(e) + (mᵢ−1)·mean(retry)),
  eventual success Pᵢ = 1 − (1 − pᵢ)^mᵢ, independent outcomes.
- Expected score depends only on the set S; time depends on order (design §8.1 key property).
- Constraint semantics: `requires(a→b)`: b only after a (and a ∈ S); `precedes(a,b)`: if both,
  a first; `excludes(a,b)`: not both.
- Attachments (FLL realism): a mission with `attachment = x` needs x mounted. Attachments can only
  be changed in home. Missions without an attachment can be done with any. In `single_run` the
  whole plan uses at most one attachment.
- `multi_run`: returning home costs τ(j, start) + reset_time; the last run may end anywhere unless
  `must_end_in_home`. `single_run`: no returns.
- Exact DP limited to n ≤ 16 candidate missions; brute force (oracle) n ≤ 7.
- WRO tie-break: among sets with equal expected score, prefer less completion time.

## Review Focus
1. Precedence cycle → validation issue naming the cycle (`m1 → m2 → m1`), optimiser refuses
   (Task 1 `test_cycle_reported_with_path`).
2. Mission requiring two mutually exclusive missions → "can never be done", excluded with reason
   (Task 1 `test_contradictory_requirements`).
3. Budget smaller than any single mission → empty plan, score 0, explanation says why
   (Task 4 `test_budget_too_small`).
4. All probabilities 0 → empty optimal plan is valid (score 0); plan with p = 1 scores exactly
   the points (Task 4 `test_zero_and_certain_probabilities`).
5. Unreachable mission → excluded with the route failure message (Task 2 `test_unreachable_excluded`).

---

### Task 1: Constraint validation
**Files:** `engine/missions/{__init__,validation}.py`, tests.
**Produces:** `validate_constraints(scenario) -> list[Issue]` — cycles in the precedence graph
(requires ∪ precedes) with the cycle path; contradictions (a mission's transitive requirements
include an excluded pair, or it excludes one of its own requirements) as `impossible_mission`
warnings; `requirement_closure(scenario) -> dict[str, set[str]]`.

### Task 2: Planning instance
**Files:** `engine/optimization/{__init__,instance}.py`, `engine/models/planning.py`, tests.
**Produces:** `PlanningSettings` model; `compile_instance(scenario, matrix, settings) ->
PlanningInstance` with candidates (ids), `tau` ((n+1)×(n+1), node 0 = start), `duration`,
`p_success`, bitmasks `requires_mask`, `after_mask`, `excludes_mask`, `attachment` indices,
`weights` / `bonuses` for the expected score, `excluded: dict[id, reason]`.
`instance.expected_score(mask) -> float`; `instance.expected_scores() -> ndarray` (all masks).

### Task 3: Brute-force oracle and plan evaluation
**Files:** `engine/optimization/{plan,bruteforce}.py`, tests.
**Produces:** `Plan(runs: list[list[int]], completion_time, expected_score, legs)`;
`evaluate(instance, runs) -> Plan | None` (None if infeasible); `brute_force(instance) -> Plan`.

### Task 4: Bitmask dynamic programming
**Files:** `engine/optimization/dp.py`, tests (equality with brute force on random instances).
**Produces:** `solve(instance, top_k=5) -> DPResult(best: Plan, top: list[Plan],
feasible_masks, best_time_by_mask, scores)` with lexicographic (score, −time) ordering.

### Task 5: Greedy baseline
**Files:** `engine/optimization/greedy.py`, tests (never better than DP; the §8.3 counterexample).

### Task 6: Explanations and sensitivity
**Files:** `engine/optimization/explain.py`, tests.
**Produces:** per-leg breakdown, slack, binding constraints, forced-in / forced-out counterfactual
values for every mission, speed sensitivity (re-timing the stored route geometry with scaled
speeds and re-solving).

### Task 7: API + scenarios B and D
**Files:** `api/routes/optimize.py`, schemas, `scenarios/b-*.json`, `scenarios/d-*.json`, tests.

### Task 8: Strategy page (frontend)
Plan timeline per run, time budget bar, greedy vs optimal comparison, excluded missions with
reasons, counterfactual table, sensitivity table, route of the plan on the arena.

### Task 9: Experiments 2 and 4 + optimisation docs
`experiments/02-greedy-vs-exact`, `experiments/04-speed-sensitivity`,
`docs/algorithms/optimization.md`.
