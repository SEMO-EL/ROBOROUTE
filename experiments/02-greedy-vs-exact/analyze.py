"""Summarise experiment 2: table (markdown) and figure from results/raw.csv."""

import csv
import statistics
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"


def main() -> None:
    rows = list(csv.DictReader((RESULTS / "raw.csv").open(encoding="utf-8")))
    groups: dict[tuple[int, float], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        groups[(int(row["n"]), float(row["rho"]))].append(row)

    lines = [
        "| n | Budget ρ | Instances | Greedy optimal | Mean gap | Median gap | Worst gap "
        "| DP median (ms) | Greedy median (ms) |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for (n, rho), group in sorted(groups.items()):
        gaps = [float(r["relative_gap"]) for r in group]
        optimal = sum(r["greedy_optimal"] == "True" for r in group)
        dp = statistics.median(float(r["dp_seconds"]) for r in group) * 1000
        gr = statistics.median(float(r["greedy_seconds"]) for r in group) * 1000
        lines.append(
            f"| {n} | {rho} | {len(group)} | {optimal / len(group):.0%} | {statistics.mean(gaps):.1%} "
            f"| {statistics.median(gaps):.1%} | {max(gaps):.1%} | {dp:.1f} | {gr:.2f} |"
        )
    by_format: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        by_format[row["format"]].append(float(row["relative_gap"]))
    lines.append("")
    for fmt, gaps in sorted(by_format.items()):
        share = sum(g <= 1e-9 for g in gaps) / len(gaps)
        lines.append(f"- {fmt}: greedy optimal in {share:.0%} of {len(gaps)} instances, mean gap {statistics.mean(gaps):.1%}")
    (RESULTS / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    sizes = sorted({n for n, _ in groups})
    rhos = sorted({rho for _, rho in groups})
    figure, axes = plt.subplots(1, 2, figsize=(10, 4), constrained_layout=True)
    for rho in rhos:
        axes[0].plot(
            sizes,
            [100 * statistics.mean(float(r["relative_gap"]) for r in groups[(n, rho)]) for n in sizes],
            "o-",
            label=f"ρ = {rho}",
        )
        axes[1].plot(
            sizes,
            [100 * sum(r["greedy_optimal"] == "True" for r in groups[(n, rho)]) / len(groups[(n, rho)]) for n in sizes],
            "o-",
            label=f"ρ = {rho}",
        )
    axes[0].set_ylabel("Mean gap to optimum (%)")
    axes[1].set_ylabel("Instances where greedy is optimal (%)")
    for axis in axes:
        axis.set_xlabel("Missions n")
        axis.grid(True, alpha=0.3)
        axis.legend()
    figure.suptitle("Experiment 2: greedy vs exact DP (random instances)")
    figure.savefig(RESULTS / "greedy_gap.png", dpi=150)
    print((RESULTS / "summary.md").read_text())


if __name__ == "__main__":
    main()
