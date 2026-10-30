import math

import pytest
from hypothesis import given
from hypothesis import strategies as st

from roboroute.engine.units import (
    angle_difference,
    cm_to_m,
    deg_to_rad,
    m_to_cm,
    normalize_angle,
    rad_to_deg,
)

finite_angles = st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False)


def test_normalize_three_pi_is_pi() -> None:
    assert normalize_angle(3 * math.pi) == pytest.approx(math.pi)


def test_normalize_minus_pi_maps_to_plus_pi() -> None:
    # The interval is half-open: (-π, π]. -π and π are the same heading; we keep +π.
    assert normalize_angle(-math.pi) == pytest.approx(math.pi)


def test_normalize_keeps_small_angles() -> None:
    assert normalize_angle(0.25) == pytest.approx(0.25)
    assert normalize_angle(-0.25) == pytest.approx(-0.25)


@given(finite_angles)
def test_normalize_result_in_half_open_interval(theta: float) -> None:
    result = normalize_angle(theta)
    assert -math.pi < result <= math.pi


@given(finite_angles)
def test_normalize_preserves_direction(theta: float) -> None:
    result = normalize_angle(theta)
    assert math.cos(result) == pytest.approx(math.cos(theta), abs=1e-6)
    assert math.sin(result) == pytest.approx(math.sin(theta), abs=1e-6)


def test_angle_difference_is_signed_shortest_turn() -> None:
    assert angle_difference(0.1, -0.1) == pytest.approx(-0.2)
    # Crossing the ±π seam: from 170° to -170° is a +20° turn, not -340°.
    assert angle_difference(deg_to_rad(170), deg_to_rad(-170)) == pytest.approx(deg_to_rad(20))


@given(finite_angles, finite_angles)
def test_angle_difference_bounded(a: float, b: float) -> None:
    assert -math.pi < angle_difference(a, b) <= math.pi


def test_unit_conversions() -> None:
    assert deg_to_rad(180) == pytest.approx(math.pi)
    assert rad_to_deg(math.pi / 2) == pytest.approx(90)
    assert cm_to_m(250) == pytest.approx(2.5)
    assert m_to_cm(0.125) == pytest.approx(12.5)
