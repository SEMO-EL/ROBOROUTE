"""Dijkstra's algorithm and A* on the occupancy grid.

Graph: one vertex per free cell; an edge to each free neighbour (4 or 8 of them) weighted by the
Euclidean distance between cell centres (h or h√2). All weights are positive, which is the
assumption Dijkstra's correctness proof needs.

Both algorithms use a binary heap (``heapq``) with *lazy deletion*: when a shorter route to a cell
is found, a new heap entry is pushed and the stale one is skipped when popped. With V cells and
E ≤ 8V edges the running time is O(E log V) and the memory O(V).
"""

import heapq
import math
from collections.abc import Iterable
from dataclasses import dataclass

from roboroute.engine.grid.occupancy import Cell, OccupancyGrid
from roboroute.engine.pathfinding.heuristics import Heuristic, estimate, is_admissible
from roboroute.engine.pathfinding.trace import Tracer


@dataclass(frozen=True)
class SearchResult:
    path: list[Cell] | None
    cost: float
    expanded: int
    generated: int
    max_frontier: int
    optimality_guaranteed: bool
    algorithm: str


def _reconstruct(parent: dict[Cell, Cell | None], goal: Cell) -> list[Cell]:
    path = [goal]
    node = parent[goal]
    while node is not None:
        path.append(node)
        node = parent[node]
    path.reverse()
    return path


def astar(
    grid: OccupancyGrid,
    start: Cell,
    goal: Cell,
    heuristic: Heuristic = Heuristic.OCTILE,
    connectivity: int = 8,
    tracer: Tracer | None = None,
) -> SearchResult:
    """Shortest path from ``start`` to ``goal`` guided by f(n) = g(n) + h(n).

    g(n) is the cost of the best known path from the start to n; h(n) estimates the remaining cost.
    Nodes are expanded in order of f. Ties are broken towards smaller h (closer to the goal), then
    by insertion order, which makes the search deterministic.
    """
    guaranteed = is_admissible(heuristic, connectivity)
    name = f"astar[{heuristic.value},{connectivity}]"
    if not (grid.is_free(start) and grid.is_free(goal)):
        return SearchResult(None, math.inf, 0, 0, 0, guaranteed, name)

    h_cell = grid.resolution

    def h_of(cell: Cell) -> float:
        return estimate(heuristic, cell, goal, h_cell)

    g: dict[Cell, float] = {start: 0.0}
    parent: dict[Cell, Cell | None] = {start: None}
    closed: set[Cell] = set()
    h0 = h_of(start)
    frontier: list[tuple[float, float, int, Cell]] = [(h0, h0, 0, start)]
    counter = 1
    expanded = 0
    max_frontier = 1

    while frontier:
        f, h_value, _, cell = heapq.heappop(frontier)
        if cell in closed:
            continue  # stale entry left behind by lazy deletion
        closed.add(cell)
        expanded += 1
        g_cell = g[cell]
        if tracer is not None:
            tracer.on_expand(cell, g_cell, h_value, f)
        if cell == goal:
            path = _reconstruct(parent, goal)
            return SearchResult(path, g_cell, expanded, counter, max_frontier, guaranteed, name)
        for neighbor, step in grid.neighbors(cell, connectivity):
            if neighbor in closed:
                continue
            candidate = g_cell + step
            if candidate < g.get(neighbor, math.inf):
                g[neighbor] = candidate
                parent[neighbor] = cell
                h_n = h_of(neighbor)
                heapq.heappush(frontier, (candidate + h_n, h_n, counter, neighbor))
                counter += 1
                if tracer is not None:
                    tracer.on_push(neighbor, cell, candidate, h_n, candidate + h_n)
        max_frontier = max(max_frontier, len(frontier))

    return SearchResult(None, math.inf, expanded, counter, max_frontier, guaranteed, name)


@dataclass(frozen=True)
class ShortestPathTree:
    """Result of single-source Dijkstra: final distances and parents of every settled cell."""

    source: Cell
    dist: dict[Cell, float]
    parent: dict[Cell, Cell | None]
    expanded: int

    def path_to(self, cell: Cell) -> list[Cell] | None:
        if cell not in self.dist:
            return None
        return _reconstruct(self.parent, cell)


def dijkstra(
    grid: OccupancyGrid,
    source: Cell,
    targets: Iterable[Cell] | None = None,
    connectivity: int = 8,
    tracer: Tracer | None = None,
) -> ShortestPathTree:
    """Settle cells in order of distance from ``source``.

    When a cell is popped its distance is final (all edge weights are positive). The search stops
    once every requested target is settled, or when the reachable region is exhausted. One run
    gives shortest paths to *all* targets, which is why the travel matrix uses it instead of one
    A* search per pair.
    """
    if not grid.is_free(source):
        return ShortestPathTree(source, {}, {}, 0)
    remaining = None if targets is None else {t for t in targets if grid.is_free(t)}
    tentative: dict[Cell, float] = {source: 0.0}
    parent: dict[Cell, Cell | None] = {source: None}
    dist: dict[Cell, float] = {}
    frontier: list[tuple[float, int, Cell]] = [(0.0, 0, source)]
    counter = 1

    while frontier:
        d, _, cell = heapq.heappop(frontier)
        if cell in dist:
            continue
        dist[cell] = d
        if tracer is not None:
            tracer.on_expand(cell, d, 0.0, d)
        if remaining is not None:
            remaining.discard(cell)
            if not remaining:
                break
        for neighbor, step in grid.neighbors(cell, connectivity):
            if neighbor in dist:
                continue
            candidate = d + step
            if candidate < tentative.get(neighbor, math.inf):
                tentative[neighbor] = candidate
                parent[neighbor] = cell
                heapq.heappush(frontier, (candidate, counter, neighbor))
                counter += 1
                if tracer is not None:
                    tracer.on_push(neighbor, cell, candidate, 0.0, candidate)

    settled_parents = {cell: parent[cell] for cell in dist}
    return ShortestPathTree(source, dist, settled_parents, len(dist))
