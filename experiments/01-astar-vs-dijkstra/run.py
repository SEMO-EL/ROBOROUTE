"""Experiment 1 — A* versus Dijkstra on grids of different sizes and obstacle densities.

Research question: how much search effort does A* save over Dijkstra on RoboRoute's planning
grids, and does the saving depend on grid size and obstacle density?

Independent variables: grid side length (cells), obstacle density (fraction of blocked cells,
placed uniformly at random), algorithm/heuristic (Dijkstra; A* with Euclidean; A* with octile).
Dependent variables: expanded nodes, median wall-clock time, peak traced memory, path cost.
All grids are 8-connected. Start and goal are random free cells in opposite corner regions;
instances where they are disconnected are redrawn (and counted).

Run from backend/:  uv run python ../experiments/01-astar-vs-dijkstra/run.py
"""

import math
import sys
import tracemalloc
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from harness import median_time, metadata, write_results  # noqa: E402

from roboroute.engine.grid.occupancy import OccupancyGrid  # noqa: E402
from roboroute.engine.pathfinding.heuristics import Heuristic  # noqa: E402
from roboroute.engine.pathfinding.search import astar, dijkstra  # noqa: E402

SEED = 20261030
SIDES = [50, 100, 200, 300]
DENSITIES = [0.0, 0.1, 0.2, 0.3]
INSTANCES = 10
REPEATS = 3
RESOLUTION = 0.01  # metres per cell; only scales costs


def random_instance(rng: np.random.Generator, side: int, density: float):  # type: ignore[no-untyped-def]
    redraws = 0
    corner = max(2, side // 10)
    while True:
        mask = rng.random((side, side)) >= density
        free = np.argwhere(mask)
        near = free[(free[:, 0] < corner) & (free[:, 1] < corner)]
        far = free[(free[:, 0] >= side - corner) & (free[:, 1] >= side - corner)]
        if len(near) and len(far):
            j0, i0 = near[rng.integers(len(near))]
            j1, i1 = far[rng.integers(len(far))]
            grid = OccupancyGrid.from_mask(mask, RESOLUTION)
            start, goal = (int(i0), int(j0)), (int(i1), int(j1))
            if astar(grid, start, goal, Heuristic.OCTILE, 8).path is not None:
                return grid, start, goal, redraws
        redraws += 1


def main() -> None:
    rng = np.random.default_rng(SEED)
    rows = []
    for side in SIDES:
        for density in DENSITIES:
            for instance in range(INSTANCES):
                grid, start, goal, redraws = random_instance(rng, side, density)
                runs = {
                    "dijkstra": lambda: dijkstra(grid, start, [goal], 8),
                    "astar_euclidean": lambda: astar(grid, start, goal, Heuristic.EUCLIDEAN, 8),
                    "astar_octile": lambda: astar(grid, start, goal, Heuristic.OCTILE, 8),
                }
                for name, run in runs.items():
                    result = run()
                    if name == "dijkstra":
                        expanded, cost = result.expanded, result.dist[goal]  # type: ignore[union-attr]
                    else:
                        expanded, cost = result.expanded, result.cost  # type: ignore[union-attr]
                    tracemalloc.start()
                    run()
                    peak = tracemalloc.get_traced_memory()[1]
                    tracemalloc.stop()
                    rows.append(
                        {
                            "side": side,
                            "cells": side * side,
                            "density": density,
                            "instance": instance,
                            "redraws": redraws,
                            "algorithm": name,
                            "expanded": expanded,
                            "cost_m": round(cost, 9),
                            "seconds": median_time(run, REPEATS),
                            "peak_bytes": peak,
                        }
                    )
            print(f"side={side} density={density} done", flush=True)
    config = {
        "sides": SIDES,
        "densities": DENSITIES,
        "instances": INSTANCES,
        "repeats": REPEATS,
        "connectivity": 8,
        "resolution_m": RESOLUTION,
    }
    write_results(HERE, rows, metadata(SEED, config))
    assert all(math.isfinite(r["cost_m"]) for r in rows)


if __name__ == "__main__":
    main()
