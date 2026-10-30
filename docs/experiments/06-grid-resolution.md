# Experiment 6 — Grid resolution

**Code:** `experiments/06-grid-resolution/{run,analyze}.py` ·
**Raw data:** `experiments/06-grid-resolution/results/raw.csv` (+ `metadata.json` with commit,
CPU and library versions) · **Figure:** `results/resolution.png`

## Question

How does the planning-grid cell size $h$ affect (a) whether routes exist, (b) the length and
modelled time of the final (smoothed) routes, and (c) how long it takes to compute the grid and
the whole travel matrix?

## Method

- Scenario A (fictional, 2.0 m × 1.2 m, 4 obstacles, 3 missions + start = 4 nodes, 12 directed
  legs), demo robot (collision radius 13.8 cm), 8-connected grid, Dijkstra per source node,
  line-of-sight smoothing, trapezoidal timing.
- Independent variable: $h \in \{5, 4, 3, 2.5, 2, 1.5, 1, 0.75, 0.5\}$ cm.
- Dependent variables: fraction of free cells, number of feasible legs, smoothed length and
  modelled time per leg, grid build time and matrix build time (median of 3 timed runs after a
  warm-up).
- **Reference:** the finest grid ($h$ = 0.5 cm). It is *not* the continuous optimum, so the table
  reports differences from it, not errors.

## Results

| h (cm) | Cells | Free cells | Feasible legs | Median length vs finest | Median time vs finest | Grid build (ms) | Matrix build (s) |
|---|---|---|---|---|---|---|---|
| 5 | 960 | 27.4% | 6 / 12 | -0.05% | -8.52% | 0.3 | 0.004 |
| 4 | 1,500 | 26.7% | 6 / 12 | -0.51% | -9.00% | 0.2 | 0.006 |
| 3 | 2,680 | 28.4% | 12 / 12 | +0.17% | -1.79% | 0.3 | 0.015 |
| 2.5 | 3,840 | 29.6% | 12 / 12 | +1.06% | -6.09% | 0.4 | 0.020 |
| 2 | 6,000 | 28.5% | 12 / 12 | +0.00% | -0.85% | 0.5 | 0.028 |
| 1.5 | 10,720 | 30.7% | 12 / 12 | +0.83% | -3.00% | 1.5 | 0.074 |
| 1 | 24,000 | 31.5% | 12 / 12 | +0.21% | +0.57% | 3.5 | 0.114 |
| 0.75 | 42,720 | 33.3% | 12 / 12 | +0.03% | -0.09% | 4.0 | 0.213 |
| 0.5 | 96,000 | 34.1% | 12 / 12 | +0.00% | +0.00% | 16.1 | 0.536 |

Machine and versions: see `results/metadata.json`.

## Discussion

1. **Coarse grids lose routes.** At 4 and 5 cm only 6 of 12 legs exist. This is the price of the
   grid safety guarantee: a cell is free only if its centre has clearance $R + h\sqrt2/2$, so the
   extra margin grows with $h$ (3.5 cm at $h$ = 5 cm) and closes the corridor above the ridge.
   The free-cell fraction rises from 27 % to 34 % as $h$ shrinks for the same reason. A route that
   "disappears" on a coarse grid is a *false negative* — the planner never reports a route that
   collides, but it can miss one that exists.
2. **Once feasible, lengths barely change.** From 3 cm down, the median smoothed length is within
   about 1 % of the finest grid. Smoothing removes most of the staircase effect of grid paths.
3. **Modelled times vary more than lengths** (up to several %), and not monotonically. Time
   depends on the number and size of turns, and greedy smoothing can end with a different number
   of corners for different grids. This is a reminder that the planner minimises *length*, not
   time (see `docs/algorithms/pathfinding.md` §10).
4. **Cost grows with the number of cells.** The full matrix (4 Dijkstra runs) took 0.54 s at
   96,000 cells. The default 2 cm grid takes 0.03 s. The API's work limit (cells × nodes ≤ 3·10⁶)
   corresponds to roughly 4 s on this machine by extrapolation of these measurements.

## Limitations

- One scenario and one robot; the feasibility threshold depends on how tight the corridors are.
- The finest grid is only a reference, not the continuous optimum.
- Timings are for this pure-Python implementation on one machine (see `metadata.json`).

## Recommendation

Default to $h$ = 2 cm for FLL/WRO-sized fields. If a mission is reported unreachable, try 1 cm
before concluding that it really is.
