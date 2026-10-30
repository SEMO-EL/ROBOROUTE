"""Experiment 2 — greedy baseline versus exact DP on random mission sets.

Research question: how often, and by how much, does the greedy "best expected points per second"
rule miss the optimal plan, and how does that depend on the number of missions and on how tight
the time budget is?

Instance generator (documented so results can be interpreted):
- n missions placed uniformly at random on a 2.4 m × 1.2 m field; the start is at (0.2, 0.2).
- Travel time between two points = distance / 0.25 m/s + 1.0 s (a fixed turning overhead) — a
  simple stand-in for the route planner so that thousands of instances can be generated.
- Mission duration ~ U(4, 20) s; points ∈ {10, 15, …, 50}; success probability ~ U(0.6, 1.0).
- Budget B = ρ × (time to do every mission in nearest-neighbour order), ρ ∈ {0.3, 0.5, 0.7}.
- No constraints or attachments: this isolates the selection-and-ordering problem.
- Half of the instances use the multi-run format (reset 5 s), half single-run.

Independent variables: n, ρ, format. Dependent: optimal and greedy expected score, relative gap,
whether greedy is optimal, DP and greedy wall time.

Run from backend/:  uv run python ../experiments/02-greedy-vs-exact/run.py
"""

import math
import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from harness import metadata, write_results  # noqa: E402

from roboroute.engine.optimization.dp import solve  # noqa: E402
from roboroute.engine.optimization.greedy import greedy  # noqa: E402
from roboroute.engine.optimization.instance import PlanningInstance  # noqa: E402

SEED = 7
SIZES = [4, 6, 8, 10, 12]
RHOS = [0.3, 0.5, 0.7]
INSTANCES = 100
SPEED = 0.25
TURN_OVERHEAD = 1.0


def nearest_neighbour_time(tau: np.ndarray, duration: np.ndarray) -> float:  # type: ignore[type-arg]
    remaining = set(range(1, len(tau)))
    current, total = 0, 0.0
    while remaining:
        nxt = min(remaining, key=lambda j: tau[current, j])
        total += tau[current, nxt] + duration[nxt - 1]
        remaining.remove(nxt)
        current = nxt
    return total


def make_instance(rng: np.random.Generator, n: int, rho: float, multi_run: bool) -> PlanningInstance:
    points = np.vstack([[0.2, 0.2], np.column_stack([rng.uniform(0, 2.4, n), rng.uniform(0, 1.2, n)])])
    distance = np.linalg.norm(points[:, None, :] - points[None, :, :], axis=2)
    tau = distance / SPEED + TURN_OVERHEAD
    np.fill_diagonal(tau, 0.0)
    duration = rng.uniform(4, 20, n)
    p = rng.uniform(0.6, 1.0, n)
    value = rng.choice(np.arange(10, 55, 5), n).astype(float)
    budget = rho * nearest_neighbour_time(tau, duration)
    return PlanningInstance(
        ids=[f"m{i}" for i in range(n)],
        names=[f"m{i}" for i in range(n)],
        tau=tau,
        duration=duration,
        p_eventual=p,
        requires_mask=[0] * n,
        after_mask=[0] * n,
        excludes_mask=[0] * n,
        attachment=[0] * n,
        attachments=[],
        budget=budget,
        multi_run=multi_run,
        reset_time=5.0 if multi_run else 0.0,
        must_end_in_home=False,
        weight=value * p,
        bonuses=[],
    )


def main() -> None:
    rng = np.random.default_rng(SEED)
    rows = []
    for n in SIZES:
        for rho in RHOS:
            for index in range(INSTANCES):
                multi_run = index % 2 == 1
                instance = make_instance(rng, n, rho, multi_run)
                start = time.perf_counter()
                optimal = solve(instance, top_k=1).best
                dp_seconds = time.perf_counter() - start
                start = time.perf_counter()
                baseline = greedy(instance)
                greedy_seconds = time.perf_counter() - start
                gap = (
                    (optimal.expected_score - baseline.expected_score) / optimal.expected_score
                    if optimal.expected_score > 0
                    else 0.0
                )
                rows.append(
                    {
                        "n": n,
                        "rho": rho,
                        "format": "multi_run" if multi_run else "single_run",
                        "instance": index,
                        "optimal_score": round(optimal.expected_score, 9),
                        "greedy_score": round(baseline.expected_score, 9),
                        "relative_gap": round(gap, 9),
                        "greedy_optimal": gap <= 1e-9,
                        "optimal_missions": bin(optimal.mask).count("1"),
                        "greedy_missions": bin(baseline.mask).count("1"),
                        "dp_seconds": dp_seconds,
                        "greedy_seconds": greedy_seconds,
                    }
                )
            print(f"n={n} rho={rho} done", flush=True)
    assert all(math.isfinite(r["optimal_score"]) for r in rows)
    config = {
        "sizes": SIZES,
        "rhos": RHOS,
        "instances": INSTANCES,
        "speed_m_s": SPEED,
        "turn_overhead_s": TURN_OVERHEAD,
    }
    write_results(HERE, rows, metadata(SEED, config))


if __name__ == "__main__":
    main()
