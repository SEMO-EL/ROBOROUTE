# Pathfinding in RoboRoute

This document explains how RoboRoute finds a collision-free route between two positions, why it
works, what it costs, and where it is weak. Code: `backend/src/roboroute/engine/geometry`,
`grid`, `pathfinding`.

## 1. The problem

Given the arena (walls, obstacles, keep-out zones), a robot of size L × W, a start position and a
goal position, find a short path along which the robot never touches anything.

Two difficulties:

1. The robot is not a point. A path that is fine for the robot's *centre* can still let its corner
   clip an obstacle.
2. The arena is continuous, but graph algorithms work on finite graphs.

## 2. From robot to point: configuration space

Instead of moving a rectangle among obstacles, we move a **point** (the robot's centre) among
obstacles that have been "grown" by the robot's size. The set of centre positions that are
collision-free is the robot's *configuration space* (C-space).

RoboRoute v1 replaces the rectangle by the smallest disc that contains it, of radius

$$R = \tfrac12\sqrt{L^2 + W^2} + m$$

where $m$ is an optional safety margin. Because a disc looks the same in every orientation, the
C-space is two-dimensional (x, y) and turning on the spot can never cause a collision.

**Example.** A 20 cm × 15 cm robot has $R = \tfrac12\sqrt{400 + 225} = 12.5$ cm.

**Limitation (honest):** the disc is larger than the robot. The same robot is only 7.5 cm from
its centre to its side, so passages between 15 cm and 25 cm wide that the real robot could drive
through *straight* are treated as blocked. Exact planning with the rectangle would need the
heading θ in the search state — a planned extension.

## 3. Clearance

The **clearance** $c(p)$ of a point $p$ is the distance to the nearest obstacle or wall, and
negative inside an obstacle. The robot's centre may be at $p$ exactly when $c(p) \ge R$.

For a rectangle, RoboRoute rotates $p$ into the rectangle's own frame, where the rectangle is
$[-w/2, w/2] \times [-h/2, h/2]$, and uses the box signed-distance formula:

$$d_x = |q_x| - w/2,\quad d_y = |q_y| - h/2,\quad
\text{sdf}(q) = \big\|(\max(d_x,0), \max(d_y,0))\big\| + \min(\max(d_x, d_y), 0).$$

For a circle of centre $c$ and radius $r$: $\text{sdf}(p) = \|p - c\| - r$.
For walls: $\min(x,\ W - x,\ y,\ H - y)$.

Segments are checked exactly too (a segment–rectangle distance is attained at a segment endpoint
or at a rectangle corner if they do not intersect). These functions are tested against Shapely
(GEOS), an independent geometry library, on thousands of random cases.

## 4. From continuous to discrete: the planning grid

The arena is divided into square cells of side $h$ (`grid_resolution`). Cell $(i, j)$ covers
$[ih, (i+1)h) \times [jh, (j+1)h)$. A cell is **free** if its centre has clearance at least

$$R + \delta,\qquad \delta = \frac{h\sqrt2}{2}.$$

**Why the extra δ? (grid safety theorem).** Clearance is *1-Lipschitz*: moving a point by a
distance $s$ changes its clearance by at most $s$. Two neighbouring cell centres are at most
$h\sqrt2$ apart, so every point on the straight segment between them is within $h\sqrt2/2 = \delta$
of one of the two centres. If both centres have clearance $\ge R + \delta$, every point of the
segment has clearance $\ge R$. **Every move the search can make is therefore collision-free in the
real, continuous arena** — not just at the cell centres. A property-based test checks exactly this
on random arenas.

The price: δ makes the grid more conservative as cells get bigger (see experiment 6).

## 5. The graph

- **Vertices:** free cells.
- **Edges:** to each free neighbour — 4 (up/down/left/right) or 8 (plus diagonals).
- **Weights:** Euclidean distance between the cell centres: $h$ for a straight step, $h\sqrt2$ for
  a diagonal step. All weights are positive.

## 6. Dijkstra's algorithm

Dijkstra keeps a tentative distance $g(n)$ for every discovered vertex and repeatedly *settles* the
unsettled vertex with the smallest $g$, then relaxes its edges: for each neighbour $m$,
$g(m) \leftarrow \min\big(g(m),\ g(n) + w(n, m)\big)$.

**Why it is correct:** when the smallest-$g$ vertex is popped, any other route to it would have to
leave the settled region through a vertex whose $g$ is already at least as large, and the remaining
edges add a non-negative amount. So its $g$ is final. This argument needs **non-negative weights**.

**Data structure:** a binary heap (`heapq`) with *lazy deletion* — when a shorter route to a vertex
is found, a new heap entry is pushed and the old one is ignored when popped.

**Complexity:** $O(E \log V)$ time and $O(V)$ memory, with $V$ free cells and $E \le 8V$ edges.

**Use in RoboRoute:** one Dijkstra run from a node settles *all* other nodes, so the travel matrix
needs one run per node instead of one search per pair.

## 7. A*

A* orders vertices by $f(n) = g(n) + h(n)$, where $h(n)$ *estimates* the remaining cost to the
goal. If $h$ never overestimates (**admissible**), the first time the goal is popped its $g$ is the
shortest distance. If additionally $h(n) \le w(n, m) + h(m)$ (**consistent**), a settled vertex
never needs to be reopened.

| Heuristic | Formula ($\Delta x, \Delta y$ in cells) | 4-connected | 8-connected |
|---|---|---|---|
| Manhattan | $h(\Delta x + \Delta y)$ | admissible, exact on empty grid | **not admissible** |
| Octile | $h\big((\max-\min) + \sqrt2\min\big)$ | admissible | admissible, exact on empty grid |
| Euclidean | $h\sqrt{\Delta x^2 + \Delta y^2}$ | admissible | admissible, looser than octile |
| Zero | $0$ | = Dijkstra | = Dijkstra |

Manhattan is not admissible with diagonal moves because one diagonal step costs $h\sqrt2 \approx
1.41h$ but Manhattan counts it as $2h$. RoboRoute still lets you choose it (to see the effect),
but marks the result `optimality_guaranteed = false`.

**Tie-breaking:** equal $f$ values are broken towards smaller $h$ (closer to the goal), then by
insertion order. This makes results deterministic and usually reduces expansions.

## 8. From grid path to driven route

1. **Snapping.** Start and goal positions are rarely cell centres. Each one is connected to the
   nearest free cell centre whose straight connection passes the *exact* segment check; if none
   exists within 3 cells, RoboRoute says so ("try a finer grid") instead of guessing.
2. **Collinear compression.** Consecutive grid steps in the same direction are merged.
3. **Smoothing (line-of-sight shortcutting).** From the current point, jump to the farthest later
   point reachable in a straight, exactly-checked free line. By the triangle inequality this never
   makes the path longer, and every kept segment was checked, so it cannot introduce a collision.
   Worst case $O(n^2)$ checks for $n$ points.
4. **Timing.** See `docs/mathematics/motion.md`.

## 9. How it is tested

- Geometry vs Shapely (property-based, hundreds of random cases per run).
- Clearance is 1-Lipschitz; vectorised and scalar clearance agree.
- Grid safety theorem: every move between free neighbours has exact clearance $\ge R$.
- A* (octile, Euclidean, zero, Manhattan on 4-connected) and Dijkstra return the same cost as
  NetworkX's Dijkstra on random grids.
- Smoothed routes are never longer than raw routes and never collide.
- Failure statuses (`pose_in_collision`, `snap_failed`, `unreachable`) are tested explicitly.

## 10. Known limitations and ideas for improvement

- **Conservative footprint.** Use the real rectangle with heading in the search state (SE(2)
  lattice planning).
- **Shortest is not fastest.** The search minimises length; time also depends on the number of
  turns. A time-aware search would put the heading in the state and charge turning time.
- **Grid paths are not the continuous optimum.** Smoothing helps, but an any-angle planner
  (Theta*) or a visibility graph would give exact shortest paths among polygons.
- **Pure Python.** Fine for competition-sized fields (experiment 1 and 6 report measured times);
  very fine grids would benefit from a compiled implementation.
