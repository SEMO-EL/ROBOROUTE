"""Path smoothing by greedy line-of-sight shortcutting.

From the current point, jump to the farthest later point that can be reached in a straight,
collision-free line; repeat. By the triangle inequality each shortcut is no longer than the
sub-path it replaces, so the result is never longer than the input, and every kept segment was
verified by ``is_free`` — smoothing cannot introduce a collision. Worst case O(n²) visibility
checks for n points.
"""

from collections.abc import Callable

from roboroute.engine.geometry.primitives import Point


def shortcut(points: list[Point], is_free: Callable[[Point, Point], bool]) -> list[Point]:
    if len(points) <= 2:
        return list(points)
    result = [points[0]]
    i = 0
    last = len(points) - 1
    while i < last:
        j = last
        while j > i + 1 and not is_free(points[i], points[j]):
            j -= 1
        result.append(points[j])
        i = j
    return result
