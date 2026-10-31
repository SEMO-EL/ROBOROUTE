"""Cross-check our geometry against Shapely (GEOS), an independent implementation."""

import math

from hypothesis import given, settings
from hypothesis import strategies as st
from shapely import affinity
from shapely.geometry import LineString, Point, box

from roboroute.engine.geometry.primitives import segment_distance, signed_distance
from roboroute.engine.models import RectShape
from tests.strategies import fl

coords = fl(-3.0, 3.0)
points = st.tuples(coords, coords)
rects = st.builds(
    RectShape,
    cx=fl(-1.0, 1.0),
    cy=fl(-1.0, 1.0),
    width=fl(0.05, 2.0),
    height=fl(0.05, 2.0),
    rotation=fl(-3.1, 3.1),
)


def shapely_rect(rect: RectShape):  # type: ignore[no-untyped-def]
    polygon = box(-rect.width / 2, -rect.height / 2, rect.width / 2, rect.height / 2)
    polygon = affinity.rotate(polygon, rect.rotation, origin=(0, 0), use_radians=True)
    return affinity.translate(polygon, rect.cx, rect.cy)


@settings(max_examples=400)
@given(rects, points)
def test_rect_signed_distance_matches_shapely(rect: RectShape, p: tuple[float, float]) -> None:
    polygon = shapely_rect(rect)
    point = Point(p)
    expected = (
        -polygon.exterior.distance(point) if polygon.contains(point) else polygon.distance(point)
    )
    assert math.isclose(signed_distance(p, rect), expected, abs_tol=1e-9)


@settings(max_examples=400)
@given(rects, points, points)
def test_segment_rect_distance_matches_shapely(
    rect: RectShape, a: tuple[float, float], b: tuple[float, float]
) -> None:
    # GEOS returns inf for a segment whose length is subnormal (e.g. (0, 1)–(5e-324, 1), found by
    # Hypothesis); such a segment is a point for every practical purpose.
    degenerate = math.dist(a, b) < 1e-12
    expected = shapely_rect(rect).distance(Point(a) if degenerate else LineString([a, b]))
    assert math.isclose(segment_distance(a, b, rect), expected, abs_tol=1e-9)


def test_subnormal_segment_is_measured_like_a_point() -> None:
    rect = RectShape(cx=0.0, cy=0.0, width=1.0, height=1.0, rotation=0.0)
    assert segment_distance((0.0, 1.0), (5e-324, 1.0), rect) == 0.5
