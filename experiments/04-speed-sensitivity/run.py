"""Experiment 4 — how robot speed changes the optimal mission selection.

Research question: when a team's robot becomes faster or slower (for example a different motor
power setting), how much does the best achievable expected score change, and at which speeds does
the optimal set of missions change?

Method: Scenarios B (single run) and D (multi-run, constraints, attachments). For each speed
factor f, the linear and turning top speeds are multiplied by f, the stored route geometry is
re-timed with the motion model, and the DP is re-solved. Accelerations and mission durations are
unchanged (mission work does not get faster with driving speed).

Run from backend/:  uv run python ../experiments/04-speed-sensitivity/run.py
"""

import dataclasses
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE.parent))

from harness import metadata, write_results  # noqa: E402

from roboroute.engine.optimization.dp import solve  # noqa: E402
from roboroute.engine.optimization.explain import retimed_tau  # noqa: E402
from roboroute.engine.optimization.greedy import greedy  # noqa: E402
from roboroute.engine.optimization.instance import compile_instance  # noqa: E402
from roboroute.engine.scenarios import load_scenario  # noqa: E402
from roboroute.engine.travel.matrix import build_travel_matrix  # noqa: E402

SCENARIOS = ["b-medium", "d-complex"]
FACTORS = [round(0.5 + 0.1 * i, 1) for i in range(11)]  # 0.5 … 1.5


def main() -> None:
    rows = []
    for name in SCENARIOS:
        scenario = load_scenario(REPO / "scenarios" / f"{name}.json")
        matrix = build_travel_matrix(scenario)
        instance = compile_instance(scenario, matrix)
        for factor in FACTORS:
            scaled = dataclasses.replace(
                instance, tau=retimed_tau(scenario, matrix, instance, factor)
            )
            best = solve(scaled, top_k=1).best
            baseline = greedy(scaled)
            selected = sorted(instance.ids[i] for i in range(instance.n) if best.mask >> i & 1)
            rows.append(
                {
                    "scenario": name,
                    "speed_factor": factor,
                    "optimal_score": round(best.expected_score, 6),
                    "greedy_score": round(baseline.expected_score, 6),
                    "missions": len(selected),
                    "selected": " ".join(selected),
                    "completion_s": round(best.completion_time, 3),
                    "travel_s": round(sum(s.seconds for s in best.steps if s.kind == "travel"), 3),
                }
            )
        print(f"{name} done", flush=True)
    write_results(HERE, rows, metadata(0, {"scenarios": SCENARIOS, "factors": FACTORS}))


if __name__ == "__main__":
    main()
