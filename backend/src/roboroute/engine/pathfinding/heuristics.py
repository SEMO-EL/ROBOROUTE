"""A* heuristics: lower bounds on the remaining path cost from a cell to the goal.

Let Δx, Δy be the absolute column and row differences and h the cell size.

- Manhattan  h·(Δx + Δy). Exact for 4-connected moves; overestimates when diagonal moves are
  allowed (a diagonal step costs h√2 < 2h), so it is *not admissible* on 8-connected grids.
- Octile     h·(max − min + √2·min). Exact for 8-connected moves on an empty grid: the tightest
  admissible heuristic for 8-connectivity, and still admissible for 4-connectivity.
- Euclidean  h·√(Δx² + Δy²). Never longer than any grid path, so admissible for both, but looser
  than octile on 8-connected grids (more nodes expanded).
- Zero       0. Turns A* into Dijkstra's algorithm.

All four are also *consistent* (h(n) ≤ cost(n, m) + h(m)) whenever they are admissible here, so A*
never needs to reopen a closed node.
"""

import math
from enum import StrEnum


class Heuristic(StrEnum):
    MANHATTAN = "manhattan"
    OCTILE = "octile"
    EUCLIDEAN = "euclidean"
    ZERO = "zero"


def estimate(heuristic: Heuristic, a: tuple[int, int], b: tuple[int, int], h: float) -> float:
    dx = abs(a[0] - b[0])
    dy = abs(a[1] - b[1])
    if heuristic is Heuristic.MANHATTAN:
        return h * (dx + dy)
    if heuristic is Heuristic.OCTILE:
        low, high = min(dx, dy), max(dx, dy)
        return h * ((high - low) + math.sqrt(2.0) * low)
    if heuristic is Heuristic.EUCLIDEAN:
        return h * math.hypot(dx, dy)
    return 0.0


def is_admissible(heuristic: Heuristic, connectivity: int) -> bool:
    """Whether A* with this heuristic is guaranteed to return a shortest path."""
    return not (heuristic is Heuristic.MANHATTAN and connectivity == 8)
