import math

import networkx as nx
import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from hypothesis.extra.numpy import arrays
from numpy.typing import NDArray

from roboroute.engine.grid.occupancy import Cell, OccupancyGrid
from roboroute.engine.pathfinding.heuristics import Heuristic, is_admissible
from roboroute.engine.pathfinding.search import astar, dijkstra
from roboroute.engine.pathfinding.trace import RecordingTracer

H = 0.1


def open_grid(columns: int = 20, rows: int = 12) -> OccupancyGrid:
    return OccupancyGrid.from_mask(np.ones((rows, columns), dtype=bool), H)


def to_networkx(grid: OccupancyGrid, connectivity: int) -> "nx.Graph[Cell]":
    graph: nx.Graph[Cell] = nx.Graph()
    for j in range(grid.rows):
        for i in range(grid.columns):
            if grid.is_free((i, j)):
                graph.add_node((i, j))
                for neighbor, cost in grid.neighbors((i, j), connectivity):
                    graph.add_edge((i, j), neighbor, weight=cost)
    return graph


def test_open_grid_cost_is_octile_distance() -> None:
    result = astar(open_grid(), (0, 0), (10, 4), Heuristic.OCTILE, 8)
    assert result.path is not None
    assert result.cost == pytest.approx(H * (6 + 4 * math.sqrt(2)))
    assert result.path[0] == (0, 0)
    assert result.path[-1] == (10, 4)


def test_start_equals_goal() -> None:
    result = astar(open_grid(), (3, 3), (3, 3), Heuristic.OCTILE, 8)
    assert result.path == [(3, 3)]
    assert result.cost == 0.0


def test_unreachable_goal_returns_none() -> None:
    mask = np.ones((10, 10), dtype=bool)
    mask[:, 5] = False  # a wall splits the grid
    grid = OccupancyGrid.from_mask(mask, H)
    result = astar(grid, (1, 1), (8, 8), Heuristic.OCTILE, 8)
    assert result.path is None
    assert result.cost == math.inf
    tree = dijkstra(grid, (1, 1), [(8, 8)], 8)
    assert tree.path_to((8, 8)) is None


def test_blocked_start_returns_none() -> None:
    mask = np.ones((5, 5), dtype=bool)
    mask[0, 0] = False
    assert astar(OccupancyGrid.from_mask(mask, H), (0, 0), (4, 4), Heuristic.OCTILE, 8).path is None


@pytest.mark.parametrize(
    ("heuristic", "connectivity", "admissible"),
    [
        (Heuristic.MANHATTAN, 4, True),
        (Heuristic.MANHATTAN, 8, False),
        (Heuristic.OCTILE, 8, True),
        (Heuristic.OCTILE, 4, True),
        (Heuristic.EUCLIDEAN, 8, True),
        (Heuristic.ZERO, 8, True),
    ],
)
def test_admissibility_table(heuristic: Heuristic, connectivity: int, admissible: bool) -> None:
    assert is_admissible(heuristic, connectivity) is admissible
    result = astar(open_grid(), (0, 0), (5, 5), heuristic, connectivity)
    assert result.optimality_guaranteed is admissible


def test_astar_expands_fewer_nodes_than_dijkstra_on_open_grid() -> None:
    grid = open_grid(40, 30)
    a = astar(grid, (2, 2), (35, 25), Heuristic.OCTILE, 8)
    d = dijkstra(grid, (2, 2), [(35, 25)], 8)
    assert a.cost == pytest.approx(d.dist[(35, 25)])
    assert a.expanded < d.expanded


def test_dijkstra_settles_every_requested_target() -> None:
    tree = dijkstra(open_grid(), (0, 0), [(19, 0), (0, 11), (10, 10)], 8)
    for target in [(19, 0), (0, 11), (10, 10)]:
        path = tree.path_to(target)
        assert path is not None
        assert path[0] == (0, 0)
        assert path[-1] == target


def test_tracer_records_g_h_f() -> None:
    tracer = RecordingTracer(max_events=10_000)
    astar(open_grid(), (0, 0), (4, 0), Heuristic.OCTILE, 8, tracer=tracer)
    first = tracer.events[0]
    assert first.kind == "expand"
    assert first.cell == (0, 0)
    assert first.g == 0.0
    assert first.h == pytest.approx(0.4)
    assert first.f == pytest.approx(first.g + first.h)
    assert any(e.kind == "push" for e in tracer.events)


def test_tracer_truncates() -> None:
    tracer = RecordingTracer(max_events=5)
    astar(open_grid(), (0, 0), (19, 11), Heuristic.ZERO, 8, tracer=tracer)
    assert len(tracer.events) == 5
    assert tracer.truncated


masks = arrays(np.bool_, st.tuples(st.integers(4, 14), st.integers(4, 14)), elements=st.booleans())


@settings(max_examples=150, deadline=None)
@given(masks, st.data())
def test_costs_match_networkx(mask: NDArray[np.bool_], data: st.DataObject) -> None:
    free = [(i, j) for j in range(mask.shape[0]) for i in range(mask.shape[1]) if mask[j, i]]
    if len(free) < 2:
        return
    start = data.draw(st.sampled_from(free))
    goal = data.draw(st.sampled_from(free))
    grid = OccupancyGrid.from_mask(mask, H)
    for connectivity in (4, 8):
        graph = to_networkx(grid, connectivity)
        try:
            expected = nx.dijkstra_path_length(graph, start, goal)
        except nx.NetworkXNoPath:
            expected = math.inf
        heuristics = [Heuristic.OCTILE, Heuristic.EUCLIDEAN, Heuristic.ZERO]
        if connectivity == 4:
            heuristics.append(Heuristic.MANHATTAN)
        for heuristic in heuristics:
            assert astar(grid, start, goal, heuristic, connectivity).cost == pytest.approx(expected)
        tree = dijkstra(grid, start, [goal], connectivity)
        assert tree.dist.get(goal, math.inf) == pytest.approx(expected)
