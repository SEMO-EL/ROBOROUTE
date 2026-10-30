import math

import pytest

from roboroute.engine.geometry.primitives import (
    point_segment_distance,
    segment_distance,
    segment_segment_distance,
    segments_intersect,
    signed_distance,
)
from roboroute.engine.models import CircleShape, RectShape


def test_point_segment_distance_projects_onto_interior() -> None:
    assert point_segment_distance((1.0, 1.0), (0.0, 0.0), (2.0, 0.0)) == pytest.approx(1.0)


def test_point_segment_distance_clamps_to_endpoint() -> None:
    assert point_segment_distance((3.0, 4.0), (0.0, 0.0), (0.0, 0.0)) == pytest.approx(5.0)
    assert point_segment_distance((-3.0, 4.0), (0.0, 0.0), (2.0, 0.0)) == pytest.approx(5.0)


def test_crossing_segments_intersect() -> None:
    assert segments_intersect((0, 0), (2, 2), (0, 2), (2, 0))
    assert segment_segment_distance((0, 0), (2, 2), (0, 2), (2, 0)) == 0.0


def test_parallel_segments_distance() -> None:
    assert not segments_intersect((0, 0), (2, 0), (0, 1), (2, 1))
    assert segment_segment_distance((0, 0), (2, 0), (0, 1), (2, 1)) == pytest.approx(1.0)


def test_rect_signed_distance_outside_and_inside() -> None:
    rect = RectShape(cx=0.0, cy=0.0, width=2.0, height=1.0)
    assert signed_distance((2.0, 0.0), rect) == pytest.approx(1.0)
    assert signed_distance((2.0, 1.5), rect) == pytest.approx(math.hypot(1.0, 1.0))
    # Inside: negative, magnitude = distance to the nearest edge.
    assert signed_distance((0.0, 0.0), rect) == pytest.approx(-0.5)


def test_rotated_rect_signed_distance() -> None:
    # A 2 x 1 rectangle rotated 90° occupies |x| ≤ 0.5, |y| ≤ 1.
    rect = RectShape(cx=0.0, cy=0.0, width=2.0, height=1.0, rotation=math.pi / 2)
    assert signed_distance((1.0, 0.0), rect) == pytest.approx(0.5)
    assert signed_distance((0.0, 1.5), rect) == pytest.approx(0.5)


def test_circle_signed_distance() -> None:
    circle = CircleShape(cx=1.0, cy=1.0, radius=0.5)
    assert signed_distance((3.0, 1.0), circle) == pytest.approx(1.5)
    assert signed_distance((1.0, 1.0), circle) == pytest.approx(-0.5)


def test_segment_through_circle_has_zero_distance() -> None:
    circle = CircleShape(cx=0.0, cy=0.0, radius=0.5)
    assert segment_distance((-2.0, 0.0), (2.0, 0.0), circle) == 0.0


def test_segment_passing_circle() -> None:
    circle = CircleShape(cx=0.0, cy=1.0, radius=0.25)
    assert segment_distance((-2.0, 0.0), (2.0, 0.0), circle) == pytest.approx(0.75)


def test_segment_through_rect_has_zero_distance() -> None:
    rect = RectShape(cx=0.0, cy=0.0, width=1.0, height=1.0, rotation=0.3)
    assert segment_distance((-2.0, 0.0), (2.0, 0.0), rect) == 0.0


def test_segment_near_rect_corner() -> None:
    rect = RectShape(cx=0.0, cy=0.0, width=1.0, height=1.0)
    # The segment runs diagonally past the corner (0.5, 0.5).
    d = segment_distance((0.0, 2.0), (2.0, 0.0), rect)
    assert d == pytest.approx(point_segment_distance((0.5, 0.5), (0.0, 2.0), (2.0, 0.0)))


def test_segment_inside_rect_has_zero_distance() -> None:
    rect = RectShape(cx=0.0, cy=0.0, width=4.0, height=4.0)
    assert segment_distance((-0.5, 0.0), (0.5, 0.0), rect) == 0.0
