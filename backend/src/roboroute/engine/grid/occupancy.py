"""Occupancy grid over the robot's configuration space.

A cell is *free* when the robot's centre can be at the cell centre without collision **and** every
straight move to a free 8-neighbour is also collision-free. Both follow from one test (grid safety
theorem, design doc §6.3): clearance(centre) ≥ R + h·√2/2, where R is the robot's collision
radius and h the cell size. Because clearance is 1-Lipschitz, every point of a move between two
adjacent free centres (length ≤ h√2) lies within h√2/2 of an endpoint and keeps clearance ≥ R.
"""

import math
from collections.abc import Iterator
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from roboroute.engine.geometry.clearance import ClearanceField
from roboroute.engine.geometry.primitives import Point
from roboroute.engine.models import Arena

Cell = tuple[int, int]
"""(i, j) = (column, row). Cell (i, j) covers [i·h, (i+1)·h) × [j·h, (j+1)·h)."""

_ORTHOGONAL = ((1, 0), (-1, 0), (0, 1), (0, -1))
_DIAGONAL = ((1, 1), (1, -1), (-1, 1), (-1, -1))


def grid_dimensions(width: float, height: float, resolution: float) -> tuple[int, int]:
    """(columns, rows) needed to cover the arena; the tolerance absorbs float error in W / h."""
    return (math.ceil(width / resolution - 1e-9), math.ceil(height / resolution - 1e-9))


@dataclass(frozen=True)
class OccupancyGrid:
    resolution: float
    columns: int
    rows: int
    free: NDArray[np.bool_]  # shape (rows, columns), indexed [j, i]
    inflation: float  # the clearance threshold R + h√2/2 used to build the grid
    _free_rows: list[list[bool]] = field(repr=False, compare=False)

    @classmethod
    def from_mask(
        cls, free: NDArray[np.bool_], resolution: float, inflation: float = 0.0
    ) -> "OccupancyGrid":
        """Wrap an explicit free/blocked mask (rows × columns); used by tests and benchmarks."""
        mask = np.asarray(free, dtype=bool)
        rows, columns = mask.shape
        return cls(resolution, columns, rows, mask, inflation, mask.tolist())

    def in_bounds(self, cell: Cell) -> bool:
        i, j = cell
        return 0 <= i < self.columns and 0 <= j < self.rows

    def is_free(self, cell: Cell) -> bool:
        i, j = cell
        return 0 <= i < self.columns and 0 <= j < self.rows and self._free_rows[j][i]

    def cell_of(self, p: Point) -> Cell:
        return (math.floor(p[0] / self.resolution), math.floor(p[1] / self.resolution))

    def center_of(self, cell: Cell) -> Point:
        return ((cell[0] + 0.5) * self.resolution, (cell[1] + 0.5) * self.resolution)

    def neighbors(self, cell: Cell, connectivity: int) -> Iterator[tuple[Cell, float]]:
        """Free neighbours and the Euclidean cost of moving there (h or h√2)."""
        i, j = cell
        h = self.resolution
        rows = self._free_rows
        for di, dj in _ORTHOGONAL:
            ni, nj = i + di, j + dj
            if 0 <= ni < self.columns and 0 <= nj < self.rows and rows[nj][ni]:
                yield (ni, nj), h
        if connectivity == 8:
            diagonal = h * math.sqrt(2.0)
            for di, dj in _DIAGONAL:
                ni, nj = i + di, j + dj
                if 0 <= ni < self.columns and 0 <= nj < self.rows and rows[nj][ni]:
                    yield (ni, nj), diagonal

    @property
    def free_count(self) -> int:
        return int(self.free.sum())

    def blocked_runs(self) -> list[tuple[int, int, int]]:
        """Run-length encoding of blocked cells as (row, first column, length) — compact for UIs."""
        runs: list[tuple[int, int, int]] = []
        for j, row in enumerate(self._free_rows):
            i = 0
            while i < self.columns:
                if row[i]:
                    i += 1
                    continue
                start = i
                while i < self.columns and not row[i]:
                    i += 1
                runs.append((j, start, i - start))
        return runs


def build_grid(arena: Arena, radius: float) -> OccupancyGrid:
    """Rasterise the configuration space for a robot of collision radius ``radius``."""
    h = arena.grid_resolution
    columns, rows = grid_dimensions(arena.width, arena.height, h)
    xs = (np.arange(columns) + 0.5) * h
    ys = (np.arange(rows) + 0.5) * h
    grid_x, grid_y = np.meshgrid(xs, ys)  # shape (rows, columns)
    inflation = radius + h * math.sqrt(2.0) / 2.0
    free = ClearanceField(arena).grid(grid_x, grid_y) >= inflation
    return OccupancyGrid(
        resolution=h,
        columns=columns,
        rows=rows,
        free=free,
        inflation=inflation,
        _free_rows=free.tolist(),
    )
