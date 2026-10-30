import math

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from roboroute.engine.models import MotionProfile, Robot
from roboroute.engine.motion.profiles import profile_time
from roboroute.engine.motion.timing import time_path
from tests.strategies import fl

TRAPEZOID = MotionProfile(max_speed=0.5, acceleration=1.0)


def robot(can_reverse: bool = True) -> Robot:
    return Robot(
        name="Bot",
        length=0.2,
        width=0.15,
        linear=MotionProfile(max_speed=0.5, acceleration=1.0),
        angular=MotionProfile(max_speed=math.pi, acceleration=2 * math.pi),
        can_reverse=can_reverse,
    )


def test_trapezoid_regime() -> None:
    # d ≥ v²/a = 0.25: t = d/v + v/a
    assert profile_time(1.0, TRAPEZOID) == pytest.approx(1.0 / 0.5 + 0.5 / 1.0)


def test_triangle_regime() -> None:
    # d < v²/a: never reaches v; t = 2√(d/a)
    assert profile_time(0.16, TRAPEZOID) == pytest.approx(0.8)


def test_regimes_meet_continuously_at_boundary() -> None:
    boundary = 0.5**2 / 1.0
    assert profile_time(boundary, TRAPEZOID) == pytest.approx(2 * math.sqrt(boundary / 1.0))


def test_constant_speed_when_acceleration_unknown() -> None:
    assert profile_time(1.2, MotionProfile(max_speed=0.4)) == pytest.approx(3.0)


def test_zero_distance_takes_no_time() -> None:
    assert profile_time(0.0, TRAPEZOID) == 0.0


@settings(max_examples=200)
@given(fl(0.0, 5.0), fl(0.0, 5.0))
def test_profile_time_is_monotonic(a: float, b: float) -> None:
    low, high = sorted((a, b))
    assert profile_time(low, TRAPEZOID) <= profile_time(high, TRAPEZOID) + 1e-12


def test_straight_drive_has_no_turns() -> None:
    timing = time_path([(0.0, 0.0), (1.0, 0.0)], start_heading=0.0, end_heading=None, robot=robot())
    assert timing.rotation == 0.0
    assert timing.translation == pytest.approx(profile_time(1.0, TRAPEZOID))
    assert timing.distance == pytest.approx(1.0)


def test_corner_adds_a_quarter_turn() -> None:
    bot = robot(can_reverse=False)
    timing = time_path([(0.0, 0.0), (1.0, 0.0), (1.0, 1.0)], 0.0, None, bot)
    assert timing.rotation == pytest.approx(profile_time(math.pi / 2, bot.angular))
    assert [leg.kind for leg in timing.legs] == ["drive", "turn", "drive"]


def test_final_heading_is_reached() -> None:
    bot = robot(can_reverse=False)
    timing = time_path([(0.0, 0.0), (1.0, 0.0)], 0.0, math.pi / 2, bot)
    assert timing.rotation == pytest.approx(profile_time(math.pi / 2, bot.angular))


def test_reversing_out_is_faster_than_turning_around() -> None:
    points = [(1.0, 0.0), (0.0, 0.0)]  # the target is directly behind the robot
    forward_only = time_path(points, 0.0, 0.0, robot(can_reverse=False))
    with_reverse = time_path(points, 0.0, 0.0, robot(can_reverse=True))
    assert with_reverse.total < forward_only.total
    assert with_reverse.rotation == 0.0
    assert with_reverse.legs[0].reverse is True


def test_zero_length_leg_only_turns() -> None:
    bot = robot()
    timing = time_path([(0.5, 0.5), (0.5, 0.5)], 0.0, math.pi / 2, bot)
    assert timing.translation == 0.0
    assert timing.total == pytest.approx(profile_time(math.pi / 2, bot.angular))


@settings(max_examples=100)
@given(
    st.lists(st.tuples(fl(0, 2), fl(0, 2)), min_size=1, max_size=8),
    fl(-3.1, 3.1),
    st.one_of(st.none(), fl(-3.1, 3.1)),
    st.booleans(),
)
def test_timing_decomposition(
    points: list[tuple[float, float]], start: float, end: float | None, can_reverse: bool
) -> None:
    timing = time_path(points, start, end, robot(can_reverse))
    assert timing.total == pytest.approx(timing.translation + timing.rotation)
    assert timing.total == pytest.approx(sum(leg.seconds for leg in timing.legs))
    if can_reverse:
        assert timing.total <= time_path(points, start, end, robot(False)).total + 1e-9
