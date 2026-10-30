import math

import numpy as np
import pytest
from hypothesis import given, settings

from roboroute.engine.geometry.clearance import ClearanceField
from roboroute.engine.grid.occupancy import build_grid, grid_dimensions
from roboroute.engine.models import Scenario
from tests.factories import scenario_dict
from tests.strategies import scenarios


def _scenario() -> Scenario:
    return Scenario.model_validate(scenario_dict())


def test_dimensions_cover_the_whole_arena() -> None:
    assert grid_dimensions(2.0, 1.2, 0.02) == (100, 60)
    assert grid_dimensions(1.0, 1.0, 0.3) == (4, 4)  # partial cells at the far edges


def test_cell_of_and_center_of_use_floor_convention() -> None:
    grid = build_grid(_scenario().arena, radius=0.1)
    assert grid.cell_of((0.0, 0.0)) == (0, 0)
    assert grid.cell_of((0.039, 0.021)) == (1, 1)
    assert grid.center_of((2, 0)) == pytest.approx((0.05, 0.01))


def test_cells_near_walls_and_obstacles_are_blocked() -> None:
    scenario = _scenario()
    grid = build_grid(scenario.arena, radius=0.1)
    assert not grid.is_free(grid.cell_of((0.01, 0.6)))  # against the left wall
    assert not grid.is_free(grid.cell_of((1.0, 0.6)))  # inside the central wall
    assert grid.is_free(grid.cell_of((0.5, 0.6)))


def test_inflation_includes_half_cell_diagonal() -> None:
    grid = build_grid(_scenario().arena, radius=0.1)
    assert grid.inflation == pytest.approx(0.1 + 0.02 * math.sqrt(2) / 2)


def test_neighbors_costs() -> None:
    grid = build_grid(_scenario().arena, radius=0.1)
    cell = grid.cell_of((0.5, 0.6))
    four = dict(grid.neighbors(cell, 4))
    eight = dict(grid.neighbors(cell, 8))
    assert len(four) == 4
    assert all(cost == pytest.approx(0.02) for cost in four.values())
    assert len(eight) == 8
    assert eight[(cell[0] + 1, cell[1] + 1)] == pytest.approx(0.02 * math.sqrt(2))


def test_blocked_runs_reconstruct_the_mask() -> None:
    grid = build_grid(_scenario().arena, radius=0.1)
    mask = np.ones((grid.rows, grid.columns), dtype=bool)
    for row, start, length in grid.blocked_runs():
        mask[row, start : start + length] = False
    np.testing.assert_array_equal(mask, grid.free)


@settings(max_examples=12, deadline=None)
@given(scenarios(max_missions=0))
def test_grid_safety_theorem(scenario: Scenario) -> None:
    """Every move between 8-adjacent free cells keeps the robot's disc out of collision."""
    radius = 0.08
    grid = build_grid(scenario.arena.model_copy(update={"grid_resolution": 0.05}), radius)
    field = ClearanceField(scenario.arena)
    for j in range(grid.rows):
        for i in range(grid.columns):
            if not grid.is_free((i, j)):
                continue
            for neighbor, _ in grid.neighbors((i, j), 8):
                a, b = grid.center_of((i, j)), grid.center_of(neighbor)
                assert field.segment(a, b) >= radius - 1e-9
