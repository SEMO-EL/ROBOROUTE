"""Summarise experiment 6: tables (markdown) and figures from results/raw.csv."""

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
    by_h: dict[float, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_h[float(row["resolution_m"])].append(row)
    finest = min(by_h)
    reference = {
        (r["from"], r["to"]): (float(r["length_m"]), float(r["modelled_s"]))
        for r in by_h[finest]
        if r["feasible"] == "True"
    }

    lines = [
        "| h (cm) | Cells | Free cells | Feasible legs | Median length vs finest "
        "| Median time vs finest | Grid build (ms) | Matrix build (s) |",
        "|---|---|---|---|---|---|---|---|",
    ]
    summary = []
    for h in sorted(by_h, reverse=True):
        group = by_h[h]
        feasible = [r for r in group if r["feasible"] == "True"]
        comparable = [r for r in feasible if (r["from"], r["to"]) in reference]
        length_ratio = (
            statistics.median(
                float(r["length_m"]) / reference[(r["from"], r["to"])][0] for r in comparable
            )
            if comparable
            else float("nan")
        )
        time_ratio = (
            statistics.median(
                float(r["modelled_s"]) / reference[(r["from"], r["to"])][1] for r in comparable
            )
            if comparable
            else float("nan")
        )
        first = group[0]
        summary.append((h, int(first["cells"]), float(first["matrix_build_s"]), len(feasible)))
        lines.append(
            f"| {h * 100:g} | {int(first['cells']):,} | {float(first['free_fraction']):.1%} "
            f"| {len(feasible)} / {len(group)} | {length_ratio - 1:+.2%} | {time_ratio - 1:+.2%} "
            f"| {float(first['grid_build_s']) * 1000:.1f} | {float(first['matrix_build_s']):.3f} |"
        )
    (RESULTS / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    figure, axes = plt.subplots(1, 2, figsize=(10, 4), constrained_layout=True)
    hs = [s[0] * 100 for s in summary]
    axes[0].plot(hs, [s[3] for s in summary], "o-")
    axes[0].set_xlabel("Grid resolution h (cm)")
    axes[0].set_ylabel(f"Feasible legs (of {len(by_h[finest])})")
    axes[0].invert_xaxis()
    axes[1].loglog([s[1] for s in summary], [s[2] for s in summary], "o-")
    axes[1].set_xlabel("Grid cells")
    axes[1].set_ylabel("Travel-matrix build time (s, median)")
    for axis in axes:
        axis.grid(True, which="both", alpha=0.3)
    figure.suptitle("Experiment 6: grid resolution (Scenario A)")
    figure.savefig(RESULTS / "resolution.png", dpi=150)
    print((RESULTS / "summary.md").read_text())


if __name__ == "__main__":
    main()
