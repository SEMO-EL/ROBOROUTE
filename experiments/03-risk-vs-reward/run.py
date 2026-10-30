"""Experiment 3 — risk versus reward: how mission reliability changes the best strategy.

Research question: as the success probability of the high-value "jackpot" mission in Scenario C
changes, (a) when does the optimiser include it, and (b) does the plan with the highest expected
score coincide with the plan most likely to reach a target score of 100 points once timing
uncertainty is simulated?

Method: Scenario C (single run, 100 s). For each jackpot probability p, the DP returns its top 5
plans; each is simulated with 20,000 trials and the same seed (common random numbers), 10 % travel
time spread. Recorded per plan: planning-model expected score, simulated mean, P(score ≥ 100),
probability of a buzzer cut-off, and whether the jackpot is included.

Run from backend/:  uv run python ../experiments/03-risk-vs-reward/run.py
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE.parent))

from harness import metadata, write_results  # noqa: E402

from roboroute.engine.models import ProbabilitySuccess  # noqa: E402
from roboroute.engine.models.simulation import SimulationConfig  # noqa: E402
from roboroute.engine.optimization.dp import solve  # noqa: E402
from roboroute.engine.optimization.instance import compile_instance  # noqa: E402
from roboroute.engine.scenarios import load_scenario  # noqa: E402
from roboroute.engine.simulation.runner import simulate  # noqa: E402
from roboroute.engine.travel.matrix import build_travel_matrix  # noqa: E402

PROBABILITIES = [0.2, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9]
TARGET = 100.0
CONFIG = SimulationConfig(trials=20_000, seed=2026, travel_time_cv=0.10)


def main() -> None:
    base = load_scenario(REPO / "scenarios" / "c-risk.json")
    matrix = build_travel_matrix(base)
    rows = []
    for p in PROBABILITIES:
        missions = [
            m.model_copy(update={"success": ProbabilitySuccess(p=p)}) if m.id == "jackpot" else m
            for m in base.missions
        ]
        scenario = base.model_copy(update={"missions": missions})
        instance = compile_instance(scenario, matrix)
        for rank, plan in enumerate(solve(instance, top_k=5).top, start=1):
            runs = [[instance.ids[i] for i in run] for run in plan.runs]
            trials = simulate(scenario, instance, runs, CONFIG)
            rows.append(
                {
                    "jackpot_p": p,
                    "model_rank": rank,
                    "model_expected": round(plan.expected_score, 6),
                    "simulated_mean": round(float(trials.score.mean()), 6),
                    "p_target": round(float((trials.score >= TARGET).mean()), 6),
                    "p_cut_off": round(float(trials.cut_off.mean()), 6),
                    "includes_jackpot": "jackpot" in runs[0] if runs else False,
                    "plan": " → ".join(m for run in runs for m in run),
                }
            )
        print(f"p={p} done", flush=True)
    write_results(HERE, rows, metadata(CONFIG.seed, {"probabilities": PROBABILITIES,
                  "target": TARGET, "trials": CONFIG.trials, "travel_time_cv": CONFIG.travel_time_cv}))


if __name__ == "__main__":
    main()
