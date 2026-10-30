"""Summarise experiment 1: tables (markdown) and figures from results/raw.csv."""

import csv
import statistics
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
ALGORITHMS = ["dijkstra", "astar_euclidean", "astar_octile"]
LABELS = {"dijkstra": "Dijkstra", "astar_euclidean": "A* Euclidean", "astar_octile": "A* octile"}


def main() -> None:
    rows = list(csv.DictReader((RESULTS / "raw.csv").open(encoding="utf-8")))
    groups: dict[tuple[int, float, str], list[dict[str, str]]] = defaultdict(list)
    costs: dict[tuple[int, float, int], set[float]] = defaultdict(set)
    for row in rows:
        groups[(int(row["side"]), float(row["density"]), row["algorithm"])].append(row)
        costs[(int(row["side"]), float(row["density"]), int(row["instance"]))].add(
            round(float(row["cost_m"]), 6)
        )
    mismatched = [key for key, values in costs.items() if len(values) != 1]

    sides = sorted({k[0] for k in groups})
    densities = sorted({k[1] for k in groups})
    lines = [
        "| Side (cells) | Density | Algorithm | Mean expanded | Expanded vs Dijkstra "
        "| Median time (ms) | Mean peak memory (KiB) |",
        "|---|---|---|---|---|---|---|",
    ]
    for side in sides:
        for density in densities:
            base = statistics.mean(int(r["expanded"]) for r in groups[(side, density, "dijkstra")])
            for algorithm in ALGORITHMS:
                group = groups[(side, density, algorithm)]
                expanded = statistics.mean(int(r["expanded"]) for r in group)
                seconds = statistics.median(float(r["seconds"]) for r in group)
                memory = statistics.mean(int(r["peak_bytes"]) for r in group) / 1024
                lines.append(
                    f"| {side}×{side} | {density:.0%} | {LABELS[algorithm]} | {expanded:,.0f} "
                    f"| {expanded / base:.1%} | {seconds * 1000:.1f} | {memory:,.0f} |"
                )
    lines.append("")
    lines.append(
        f"Path-cost agreement: {len(costs) - len(mismatched)} of {len(costs)} instances have "
        "identical costs for all three algorithms."
    )
    (RESULTS / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    figure, axes = plt.subplots(1, 2, figsize=(10, 4), constrained_layout=True)
    for algorithm, style in zip(ALGORITHMS, ["o-", "s--", "^-."], strict=True):
        for density, alpha in zip(densities, [1.0, 0.75, 0.5, 0.3], strict=False):
            xs = [side * side for side in sides]
            expanded = [
                statistics.mean(int(r["expanded"]) for r in groups[(s, density, algorithm)])
                for s in sides
            ]
            seconds = [
                statistics.median(float(r["seconds"]) for r in groups[(s, density, algorithm)])
                for s in sides
            ]
            label = f"{LABELS[algorithm]}, {density:.0%}"
            axes[0].plot(xs, expanded, style, alpha=alpha, label=label)
            axes[1].plot(xs, [t * 1000 for t in seconds], style, alpha=alpha, label=label)
    for axis, ylabel in zip(axes, ["Expanded nodes (mean)", "Wall time, ms (median)"], strict=True):
        axis.set_xscale("log")
        axis.set_yscale("log")
        axis.set_xlabel("Grid cells")
        axis.set_ylabel(ylabel)
        axis.grid(True, which="both", alpha=0.3)
    axes[1].legend(fontsize=6, ncol=1, loc="upper left")
    figure.suptitle("Experiment 1: A* vs Dijkstra (8-connected, random obstacles)")
    figure.savefig(RESULTS / "expanded_and_time.png", dpi=150)
    print((RESULTS / "summary.md").read_text())


if __name__ == "__main__":
    main()
