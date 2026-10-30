import math

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from roboroute.engine.geometry.clearance import ClearanceField
from roboroute.engine.models import Arena, Scenario
from tests.factories import scenario_dict
from tests.strategies import fl, scenarios


def _arena() -> Arena:
    return Scenario.model_validate(scenario_dict()).arena


def test_boundary_clearance_is_distance_to_nearest_wall() -> None:
    field = ClearanceField(_arena().model_copy(update={"obstacles": []}))
    assert field.at((0.3, 0.5)) == pytest.approx(0.3)
    assert field.at((1.9, 0.6)) == pytest.approx(0.1)
    assert field.at((-0.1, 0.6)) == pytest.approx(-0.1)  # outside the arena: negative


def test_obstacle_clearance_is_signed() -> None:
    field = ClearanceField(_arena())
    # The 0.1 m wide wall at x = 1.0 spans x ∈ [0.95, 1.05], y ∈ [0.3, 0.9].
    assert field.at((0.85, 0.6)) == pytest.approx(0.1)
    assert field.at((1.0, 0.6)) == pytest.approx(-0.05)


def test_segment_through_obstacle_has_zero_clearance() -> None:
    field = ClearanceField(_arena())
    assert field.segment((0.5, 0.6), (1.5, 0.6)) == 0.0


def test_segment_clearance_includes_boundary() -> None:
    field = ClearanceField(_arena().model_copy(update={"obstacles": []}))
    assert field.segment((0.2, 0.5), (1.0, 0.5)) == pytest.approx(0.2)


@settings(max_examples=60)
@given(scenarios(), st.lists(st.tuples(fl(-0.2, 3.2), fl(-0.2, 2.2)), min_size=1, max_size=30))
def test_vectorised_grid_matches_scalar(scenario: Scenario, pts: list[tuple[float, float]]) -> None:
    field = ClearanceField(scenario.arena)
    xs = np.array([p[0] for p in pts])
    ys = np.array([p[1] for p in pts])
    expected = np.array([field.at(p) for p in pts])
    np.testing.assert_allclose(field.grid(xs, ys), expected, atol=1e-12)


@settings(max_examples=200)
@given(scenarios(), st.tuples(fl(0, 3), fl(0, 2)), st.tuples(fl(0, 3), fl(0, 2)))
def test_clearance_is_one_lipschitz(
    scenario: Scenario, p: tuple[float, float], q: tuple[float, float]
) -> None:
    """|c(p) − c(q)| ≤ |p − q|: the property the grid safety theorem relies on."""
    field = ClearanceField(scenario.arena)
    assert abs(field.at(p) - field.at(q)) <= math.dist(p, q) + 1e-9


@settings(max_examples=200)
@given(scenarios(), st.tuples(fl(0, 3), fl(0, 2)), st.tuples(fl(0, 3), fl(0, 2)))
def test_segment_clearance_never_exceeds_endpoint_clearance(
    scenario: Scenario, a: tuple[float, float], b: tuple[float, float]
) -> None:
    field = ClearanceField(scenario.arena)
    assert field.segment(a, b) <= max(0.0, min(field.at(a), field.at(b))) + 1e-12
