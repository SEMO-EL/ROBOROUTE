"""Summarise experiment 5: RMSE vs N, fitted log–log slope, interval coverage."""

import csv
import math
import statistics
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"


def main() -> None:
    rows = list(csv.DictReader((RESULTS / "raw.csv").open(encoding="utf-8")))
    by_n: dict[int, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_n[int(row["trials"])].append(row)
    sizes = sorted(by_n)
    rmse = [math.sqrt(statistics.mean(float(r["error"]) ** 2 for r in by_n[n])) for n in sizes]
    coverage = [sum(r["covered"] == "True" for r in by_n[n]) / len(by_n[n]) for n in sizes]
    slope, intercept = np.polyfit(np.log10(sizes), np.log10(rmse), 1)
    truth = float(rows[0]["truth"])
    lines = [
        f"True expected score (planning model): {truth:.4f}",
        "",
        "| Trials N | RMSE (points) | Mean |error| | 95 % CI coverage |",
        "|---|---|---|---|",
    ]
    for n, e, c in zip(sizes, rmse, coverage, strict=True):
        mean_abs = statistics.mean(abs(float(r["error"])) for r in by_n[n])
        lines.append(f"| {n:,} | {e:.3f} | {mean_abs:.3f} | {c:.0%} |")
    lines += ["", f"Fitted log10(RMSE) = {slope:.3f} · log10(N) + {intercept:.3f} (theory: slope −0.5)"]
    (RESULTS / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    figure, axes = plt.subplots(1, 2, figsize=(10, 4), constrained_layout=True)
    axes[0].loglog(sizes, rmse, "o-", label="measured RMSE")
    axes[0].loglog(sizes, [rmse[0] * math.sqrt(sizes[0] / n) for n in sizes], "--", label="∝ 1/√N")
    axes[0].set_xlabel("Trials N")
    axes[0].set_ylabel("RMSE of the mean (points)")
    axes[0].legend()
    axes[1].semilogx(sizes, [100 * c for c in coverage], "o-")
    axes[1].axhline(95, linestyle="--", color="grey")
    axes[1].set_ylim(80, 100)
    axes[1].set_xlabel("Trials N")
    axes[1].set_ylabel("Coverage of 95 % intervals (%)")
    for axis in axes:
        axis.grid(True, which="both", alpha=0.3)
    figure.suptitle("Experiment 5: Monte Carlo convergence (Scenario D, no cut-offs)")
    figure.savefig(RESULTS / "convergence.png", dpi=150)
    print((RESULTS / "summary.md").read_text())


if __name__ == "__main__":
    main()
