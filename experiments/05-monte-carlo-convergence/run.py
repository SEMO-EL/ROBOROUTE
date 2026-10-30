"""Experiment 5 — Monte Carlo convergence and confidence-interval coverage.

Research question: how quickly does the simulated mean score converge to the true expected score
as the number of trials N grows, and do RoboRoute's 95 % confidence intervals contain the true
value about 95 % of the time?

Method: Scenario D with the time budget relaxed to 600 s, so that no trial is cut off by the
buzzer. Then the exact expected score of the optimal plan is known from the planning model (the
DP), and the simulation must converge to it (design doc §9.5). For each N, R independent seeds
are run; we record the estimate, its error and whether the 95 % interval covers the truth.

Expected: root-mean-square error ∝ 1/√N (slope −0.5 on a log–log plot); coverage ≈ 95 %.

Run from backend/:  uv run python ../experiments/05-monte-carlo-convergence/run.py
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE.parent))

from harness import metadata, write_results  # noqa: E402

from roboroute.engine.models.simulation import SimulationConfig  # noqa: E402
from roboroute.engine.optimization.dp import solve  # noqa: E402
from roboroute.engine.optimization.instance import compile_instance  # noqa: E402
from roboroute.engine.scenarios import load_scenario  # noqa: E402
from roboroute.engine.simulation.runner import simulate  # noqa: E402
from roboroute.engine.stats.summary import mean_ci  # noqa: E402
from roboroute.engine.travel.matrix import build_travel_matrix  # noqa: E402

TRIALS = [10, 30, 100, 300, 1_000, 3_000, 10_000, 30_000]
SEEDS = 100


def main() -> None:
    scenario = load_scenario(REPO / "scenarios" / "d-complex.json")
    scenario = scenario.model_copy(
        update={"format": scenario.format.model_copy(update={"time_budget": 600.0})}
    )
    instance = compile_instance(scenario, build_travel_matrix(scenario))
    best = solve(instance).best
    truth = best.expected_score
    runs = [[instance.ids[i] for i in run] for run in best.runs]
    rows = []
    for n in TRIALS:
        for seed in range(SEEDS):
            trials = simulate(scenario, instance, runs, SimulationConfig(trials=n, seed=seed))
            assert not trials.cut_off.any()
            mean, interval = mean_ci(trials.score)
            rows.append(
                {
                    "trials": n,
                    "seed": seed,
                    "estimate": round(mean, 9),
                    "truth": round(truth, 9),
                    "error": round(mean - truth, 9),
                    "ci_low": round(interval.low, 9),
                    "ci_high": round(interval.high, 9),
                    "covered": interval.low <= truth <= interval.high,
                }
            )
        print(f"N={n} done", flush=True)
    config = {"scenario": "d-complex (budget 600 s)", "trials": TRIALS, "seeds": SEEDS,
              "plan": runs, "true_expected_score": truth}
    write_results(HERE, rows, metadata(0, config))


if __name__ == "__main__":
    main()
