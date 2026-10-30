"""Clearance: how far a point (or segment) is from the nearest obstacle or arena wall.

``at(p)`` is a signed distance: positive in free space, negative inside an obstacle or outside the
arena. It is 1-Lipschitz (it changes no faster than the point moves), which is what makes the
grid safety theorem of design doc §6.3 work.
"""

import math

import numpy as np
from numpy.typing import NDArray

from roboroute.engine.geometry.primitives import Point, segment_distance, signed_distance
from roboroute.engine.models import Arena, CircleShape, RectShape

FloatArray = NDArray[np.float64]


class ClearanceField:
    def __init__(self, arena: Arena) -> None:
        self.width = arena.width
        self.height = arena.height
        self.shapes: list[RectShape | CircleShape] = [o.shape for o in arena.obstacles]

    def boundary(self, p: Point) -> float:
        """Distance to the nearest arena wall; negative outside the arena."""
        x, y = p
        return min(x, self.width - x, y, self.height - y)

    def at(self, p: Point) -> float:
        return min([self.boundary(p), *(signed_distance(p, s) for s in self.shapes)])

    def segment(self, a: Point, b: Point) -> float:
        """Smallest clearance along segment ab (0 if it touches an obstacle).

        The wall term is ``min(x, W − x, y, H − y)``, a concave function; a concave function's
        minimum over a segment is attained at an endpoint, so checking a and b is exact.
        """
        return min(
            [
                self.boundary(a),
                self.boundary(b),
                *(segment_distance(a, b, s) for s in self.shapes),
            ]
        )

    def grid(self, xs: FloatArray, ys: FloatArray) -> FloatArray:
        """Vectorised ``at`` for arrays of x and y coordinates (same shape)."""
        result: FloatArray = np.minimum.reduce([xs, self.width - xs, ys, self.height - ys]).astype(
            np.float64
        )
        for shape in self.shapes:
            np.minimum(result, _shape_sdf(shape, xs, ys), out=result)
        return result


def _shape_sdf(shape: RectShape | CircleShape, xs: FloatArray, ys: FloatArray) -> FloatArray:
    if isinstance(shape, CircleShape):
        sdf: FloatArray = np.hypot(xs - shape.cx, ys - shape.cy) - shape.radius
        return sdf
    cos_r, sin_r = math.cos(shape.rotation), math.sin(shape.rotation)
    x, y = xs - shape.cx, ys - shape.cy
    qx = cos_r * x + sin_r * y
    qy = -sin_r * x + cos_r * y
    dx = np.abs(qx) - shape.width / 2
    dy = np.abs(qy) - shape.height / 2
    outside = np.hypot(np.maximum(dx, 0.0), np.maximum(dy, 0.0))
    inside = np.minimum(np.maximum(dx, dy), 0.0)
    box: FloatArray = outside + inside
    return box
