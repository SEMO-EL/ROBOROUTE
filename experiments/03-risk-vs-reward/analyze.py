"""Summarise experiment 3: per jackpot probability, compare model ranking with simulated outcomes."""

import csv
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"


def main() -> None:
    rows = list(csv.DictReader((RESULTS / "raw.csv").open(encoding="utf-8")))
    by_p: dict[float, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_p[float(row["jackpot_p"])].append(row)
    lines = [
        "| Jackpot p | Model-optimal includes jackpot | Model-optimal: simulated mean / P(≥100) / cut-off "
        "| Best simulated mean (model rank) | Best P(≥100) (model rank) |",
        "|---|---|---|---|---|",
    ]
    summary = []
    for p in sorted(by_p):
        plans = by_p[p]
        top = next(r for r in plans if r["model_rank"] == "1")
        best_mean = max(plans, key=lambda r: float(r["simulated_mean"]))
        best_target = max(plans, key=lambda r: float(r["p_target"]))
        summary.append((p, top, best_mean, best_target))
        lines.append(
            f"| {p} | {'yes' if top['includes_jackpot'] == 'True' else 'no'} "
            f"| {float(top['simulated_mean']):.1f} / {float(top['p_target']):.1%} / {float(top['p_cut_off']):.1%} "
            f"| {float(best_mean['simulated_mean']):.1f} (#{best_mean['model_rank']}) "
            f"| {float(best_target['p_target']):.1%} (#{best_target['model_rank']}) |"
        )
    (RESULTS / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    ps = [s[0] for s in summary]
    figure, axes = plt.subplots(1, 2, figsize=(10, 4), constrained_layout=True)
    axes[0].plot(ps, [float(s[1]["model_expected"]) for s in summary], "o--", label="model-optimal: planning model")
    axes[0].plot(ps, [float(s[1]["simulated_mean"]) for s in summary], "o-", label="model-optimal: simulated")
    axes[0].plot(ps, [float(s[2]["simulated_mean"]) for s in summary], "s-", label="best of top 5: simulated")
    axes[0].set_ylabel("Expected score (points)")
    axes[1].plot(ps, [100 * float(s[1]["p_target"]) for s in summary], "o-", label="model-optimal plan")
    axes[1].plot(ps, [100 * float(s[3]["p_target"]) for s in summary], "s-", label="best of top 5")
    axes[1].set_ylabel("P(score ≥ 100) (%)")
    for axis in axes:
        axis.set_xlabel("Jackpot success probability")
        axis.grid(True, alpha=0.3)
        axis.legend(fontsize=8)
    figure.suptitle("Experiment 3: risk vs reward (Scenario C, 20,000 trials per plan)")
    figure.savefig(RESULTS / "risk_vs_reward.png", dpi=150)
    print((RESULTS / "summary.md").read_text())


if __name__ == "__main__":
    main()
