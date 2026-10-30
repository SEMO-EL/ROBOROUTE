"""Distance and intersection primitives for points, segments, rectangles and circles.

Conventions: points are ``(x, y)`` tuples in metres. ``signed_distance`` is negative inside a
shape (a signed distance function, SDF). ``segment_distance`` is the smallest distance between a
segment and a shape, and exactly ``0.0`` when they touch or overlap.
"""

import math

from roboroute.engine.models import CircleShape, RectShape

Point = tuple[float, float]
Shape = RectShape | CircleShape


def point_segment_distance(p: Point, a: Point, b: Point) -> float:
    """Distance from ``p`` to the closest point of segment ``ab``.

    Project ``p`` onto the line through ``a`` and ``b``: ``t = (p − a)·(b − a) / |b − a|²``, then
    clamp ``t`` to [0, 1] so the closest point stays on the segment.
    """
    ax, ay = a
    dx, dy = b[0] - ax, b[1] - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0.0:
        return math.hypot(p[0] - ax, p[1] - ay)
    t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / length_sq
    t = min(1.0, max(0.0, t))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


def _orientation(a: Point, b: Point, c: Point) -> float:
    """Twice the signed area of triangle abc: > 0 counter-clockwise, < 0 clockwise."""
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def segments_intersect(a: Point, b: Point, c: Point, d: Point) -> bool:
    """True if segments ab and cd properly cross (each one's endpoints lie on opposite sides).

    Touching and collinear overlaps are not "proper" crossings; they are still detected by
    ``segment_segment_distance`` because one endpoint then lies on the other segment (distance 0).
    """
    d1 = _orientation(c, d, a)
    d2 = _orientation(c, d, b)
    d3 = _orientation(a, b, c)
    d4 = _orientation(a, b, d)
    return ((d1 > 0 > d2) or (d1 < 0 < d2)) and ((d3 > 0 > d4) or (d3 < 0 < d4))


def segment_segment_distance(a: Point, b: Point, c: Point, d: Point) -> float:
    """Smallest distance between segments ab and cd (0 if they cross or touch).

    If two segments do not cross, their closest pair of points always includes an endpoint of one
    of them, so the minimum of four point–segment distances is exact.
    """
    if segments_intersect(a, b, c, d):
        return 0.0
    return min(
        point_segment_distance(a, c, d),
        point_segment_distance(b, c, d),
        point_segment_distance(c, a, b),
        point_segment_distance(d, a, b),
    )


def _to_rect_frame(p: Point, rect: RectShape) -> Point:
    """Express ``p`` in the rectangle's own frame (centre at origin, axis-aligned)."""
    cos_r, sin_r = math.cos(rect.rotation), math.sin(rect.rotation)
    x, y = p[0] - rect.cx, p[1] - rect.cy
    return (cos_r * x + sin_r * y, -sin_r * x + cos_r * y)


def _box_sdf(q: Point, half_w: float, half_h: float) -> float:
    """Signed distance from ``q`` to the axis-aligned box [−half_w, half_w] × [−half_h, half_h]."""
    dx = abs(q[0]) - half_w
    dy = abs(q[1]) - half_h
    outside = math.hypot(max(dx, 0.0), max(dy, 0.0))
    inside = min(max(dx, dy), 0.0)
    return outside + inside


def signed_distance(p: Point, shape: Shape) -> float:
    if isinstance(shape, CircleShape):
        return math.hypot(p[0] - shape.cx, p[1] - shape.cy) - shape.radius
    return _box_sdf(_to_rect_frame(p, shape), shape.width / 2, shape.height / 2)


def segment_distance(a: Point, b: Point, shape: Shape) -> float:
    """Distance between segment ab and a shape; 0 if the segment touches or enters it."""
    if isinstance(shape, CircleShape):
        return max(0.0, point_segment_distance((shape.cx, shape.cy), a, b) - shape.radius)

    half_w, half_h = shape.width / 2, shape.height / 2
    la, lb = _to_rect_frame(a, shape), _to_rect_frame(b, shape)
    if _box_sdf(la, half_w, half_h) <= 0.0 or _box_sdf(lb, half_w, half_h) <= 0.0:
        return 0.0
    corners = [(-half_w, -half_h), (half_w, -half_h), (half_w, half_h), (-half_w, half_h)]
    edges = list(zip(corners, corners[1:] + corners[:1], strict=True))
    if any(segments_intersect(la, lb, c, d) for c, d in edges):
        return 0.0
    # Disjoint convex sets: the closest pair involves a segment endpoint or a rectangle corner.
    return min(
        _box_sdf(la, half_w, half_h),
        _box_sdf(lb, half_w, half_h),
        *(point_segment_distance(corner, la, lb) for corner in corners),
    )
