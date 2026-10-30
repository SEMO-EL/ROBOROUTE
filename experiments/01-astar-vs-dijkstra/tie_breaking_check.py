"""Diagnostic for experiment 1: does floating-point noise in g defeat A* tie-breaking?

On an obstacle-free 8-connected grid the octile heuristic is exact, so an A* with perfect
tie-breaking expands only the cells on the path. This script compares the engine's A* with a
variant whose heap keys are rounded to 1e-9 m. Run from backend/:
    uv run python ../experiments/01-astar-vs-dijkstra/tie_breaking_check.py
Since commit "fix(engine): round A* heap keys", the engine itself rounds its keys, so both columns
now agree; the pre-fix numbers are recorded in docs/experiments/01-astar-vs-dijkstra.md.
"""
import heapq, math
import numpy as np
from roboroute.engine.grid.occupancy import OccupancyGrid
from roboroute.engine.pathfinding.heuristics import Heuristic, estimate
from roboroute.engine.pathfinding.search import astar

def astar_rounded(grid, start, goal, digits):
    h = grid.resolution
    g = {start: 0.0}; closed = set(); counter = 0
    heap = [(round(estimate(Heuristic.OCTILE, start, goal, h), digits), 0.0, 0, start)]
    expanded = 0
    while heap:
        f, hv, _, cell = heapq.heappop(heap)
        if cell in closed: continue
        closed.add(cell); expanded += 1
        if cell == goal: return expanded
        for nb, cost in grid.neighbors(cell, 8):
            if nb in closed: continue
            cand = g[cell] + cost
            if cand < g.get(nb, math.inf):
                g[nb] = cand; hn = estimate(Heuristic.OCTILE, nb, goal, h); counter += 1
                heapq.heappush(heap, (round(cand + hn, digits), round(hn, digits), counter, nb))

for side in (50, 100, 200, 300):
    grid = OccupancyGrid.from_mask(np.ones((side, side), bool), 0.01)
    start, goal = (2, 3), (side - 3, int(side * 0.6))
    plain = astar(grid, start, goal, Heuristic.OCTILE, 8)
    print(f"side={side} path_cells={len(plain.path)} expanded_float={plain.expanded} expanded_rounded={astar_rounded(grid, start, goal, 9)}")
