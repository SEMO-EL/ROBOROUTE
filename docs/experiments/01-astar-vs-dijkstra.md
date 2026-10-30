# Experiment 1 — A* versus Dijkstra

**Code:** `experiments/01-astar-vs-dijkstra/{run,analyze,tie_breaking_check}.py` ·
**Raw data:** `experiments/01-astar-vs-dijkstra/results/raw.csv` (+ `metadata.json`) ·
**Figure:** `results/expanded_and_time.png`

## Question

How much search effort does A* save compared with Dijkstra on RoboRoute's planning grids, and how
does the saving depend on grid size, obstacle density and the heuristic?

## Method

- **Grids:** square, 8-connected, side 50, 100, 200, 300 cells. Obstacles: each cell blocked
  independently with probability 0 %, 10 %, 20 %, 30 % (seeded random "noise" maps).
- **Queries:** start and goal drawn uniformly from free cells in opposite corner regions (10 % of
  the side). Instances with no path are redrawn. 10 instances per (side, density); seed 20261030.
- **Algorithms:** Dijkstra (stopping when the goal is settled); A* with the Euclidean heuristic;
  A* with the octile heuristic. Both heuristics are admissible on 8-connected grids.
- **Measured:** expanded nodes; wall time (median of 3 runs after a warm-up); peak memory traced
  by Python's `tracemalloc` (allocations made by Python code only); path cost.
- **Validity check:** all three algorithms must return the same path cost (they are all exact).

## Results (after the tie-breaking fix described below)

Mean over 10 instances; time is the median over instances of each instance's median.

| Grid | Density | Dijkstra expanded | A* Euclidean | A* octile | Dijkstra ms | A* octile ms |
|---|---|---|---|---|---|---|
| 50×50 | 0% | 2,484 | 155 (6.2%) | 48 (1.9%) | 8.1 | 0.6 |
| 50×50 | 30% | 1,750 | 452 (25.9%) | 273 (15.6%) | 5.3 | 1.4 |
| 100×100 | 0% | 9,927 | 496 (5.0%) | 93 (0.9%) | 34.9 | 1.2 |
| 100×100 | 30% | 6,937 | 1,738 (25.1%) | 939 (13.5%) | 22.2 | 6.3 |
| 200×200 | 0% | 39,806 | 2,583 (6.5%) | 187 (0.5%) | 166.7 | 2.4 |
| 200×200 | 30% | 27,831 | 6,670 (24.0%) | 3,680 (13.2%) | 98.3 | 23.0 |
| 300×300 | 0% | 89,513 | 6,059 (6.8%) | 282 (0.3%) | 451.2 | 3.7 |
| 300×300 | 10% | 80,364 | 8,946 (11.1%) | 2,380 (3.0%) | 359.7 | 23.3 |
| 300×300 | 30% | 62,696 | 15,663 (25.0%) | 8,524 (13.6%) | 255.4 | 60.9 |

The full table (all densities, memory) is in `results/summary.md`.
**Path-cost agreement: 160 of 160 instances** returned identical costs for all three algorithms.

Machine: Intel Xeon @ 2.80 GHz, Python 3.13.17, NumPy 2.5.4 (`results/metadata.json`). The
metadata flags the working tree as dirty: at the time, uncommitted files of the next milestone
(optimisation code) existed; the pathfinding code measured here was committed (`42ffc80`).

## An unexpected result, investigated

In the first run, A* with the octile heuristic on **empty** grids expanded far more cells than the
path length — 81 cells at 50×50 but 3,330 at 300×300. On an empty 8-connected grid the octile
heuristic is *exact*, so with good tie-breaking A* should expand only the cells on the path.

**Hypothesis:** the heap keys $f = g + h$ are floating-point sums of $h$ and $h\sqrt2$. Cells that
are equally good in exact arithmetic end up with $f$ values differing by about $10^{-15}$, and those
tiny differences — not the intended tie-breaking rule ("prefer smaller $h$") — decide the order.

**Test** (`tie_breaking_check.py`): the same search with keys rounded to $10^{-9}$ m.

| Side | Path cells | Expanded (float keys) | Expanded (rounded keys) |
|---|---|---|---|
| 50 | 46 | 270 | 46 |
| 100 | 96 | 239 | 96 |
| 200 | 196 | 5,440 | 196 |
| 300 | 296 | 2,601 | 296 |

The hypothesis holds. The engine now rounds its heap keys to 1 nm (commit `42ffc80`), with a
regression test asserting that A* on an empty grid expands exactly the path. The table above is
from the re-run after the fix. Rounding at 1 nm cannot change which route is shortest by any
physically meaningful amount.

## Discussion

1. **A* with octile is the right default.** It expanded 0.3 %–15.6 % of Dijkstra's nodes and was
   roughly 4× to 120× faster here, with identical path costs.
2. **The saving shrinks as obstacles get denser.** At 30 % density A* octile still expanded about
   13–16 % of Dijkstra's nodes: obstacles force detours the heuristic cannot anticipate.
3. **Octile beats Euclidean everywhere**, as theory predicts: both are admissible, but octile is
   the tighter lower bound on 8-connected grids.
4. **Dijkstra still has a role.** It answers "shortest paths to every other node" in one run, which
   is what the travel matrix needs; A* answers one pair at a time.

## Limitations

- Random noise maps are a standard benchmark but do not look like competition fields; experiment 6
  uses a realistic arena.
- Wall times depend on this pure-Python implementation and on this machine; expanded-node counts
  are the implementation-independent measure.
- `tracemalloc` only sees memory allocated through Python and does not include interpreter overhead.
