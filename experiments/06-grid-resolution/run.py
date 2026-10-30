"""Experiment 6 — effect of grid resolution on route quality, feasibility and computation time.

Research question: how does the planning-grid cell size h change (a) whether routes exist,
(b) the length and modelled time of the smoothed routes, and (c) the time to build the grid and
the full travel matrix?

Independent variable: h ∈ RESOLUTIONS (Scenario A, demo robot, 8-connectivity, Dijkstra).
Dependent variables: free-cell fraction, number of feasible legs, smoothed length and modelled
time per leg, grid build time, travel-matrix build time (median of REPEATS).
Reference: the finest resolution. It is not ground truth — a finer grid can still differ from
the continuous optimum — so relative differences are reported against it, not as "errors".

Run from backend/:  uv run python ../experiments/06-grid-resolution/run.py
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE.parent))

from harness import median_time, metadata, write_results  # noqa: E402

from roboroute.engine.grid.occupancy import build_grid  # noqa: E402
from roboroute.engine.pathfinding.routes import RoutePlanner  # noqa: E402
from roboroute.engine.scenarios import load_scenario  # noqa: E402
from roboroute.engine.travel.matrix import build_travel_matrix  # noqa: E402

RESOLUTIONS = [0.05, 0.04, 0.03, 0.025, 0.02, 0.015, 0.01, 0.0075, 0.005]
REPEATS = 3


def main() -> None:
    base = load_scenario(REPO / "scenarios" / "a-simple-arena.json")
    rows = []
    for h in RESOLUTIONS:
        arena = base.arena.model_copy(update={"grid_resolution": h})
        scenario = base.model_copy(update={"arena": arena})
        radius = scenario.robot.footprint_radius
        grid = build_grid(arena, radius)
        grid_seconds = median_time(lambda: build_grid(arena, radius), REPEATS)  # noqa: B023
        matrix = build_travel_matrix(scenario)
        matrix_seconds = median_time(
            lambda: build_travel_matrix(scenario, RoutePlanner(scenario)),  # noqa: B023
            REPEATS,
        )
        for a in matrix.nodes:
            for b in matrix.nodes:
                if a == b:
                    continue
                leg = matrix.legs.get((a, b))
                rows.append(
                    {
                        "resolution_m": h,
                        "cells": grid.columns * grid.rows,
                        "free_fraction": round(grid.free_count / (grid.columns * grid.rows), 6),
                        "from": a,
                        "to": b,
                        "feasible": leg is not None,
                        "length_m": round(leg.length, 6) if leg else "",
                        "modelled_s": round(leg.seconds, 6) if leg else "",
                        "grid_build_s": grid_seconds,
                        "matrix_build_s": matrix_seconds,
                    }
                )
        print(f"h={h} cells={grid.columns * grid.rows} matrix={matrix_seconds:.3f}s", flush=True)
    write_results(
        HERE,
        rows,
        metadata(0, {"scenario": base.id, "resolutions_m": RESOLUTIONS, "repeats": REPEATS}),
    )


if __name__ == "__main__":
    main()
