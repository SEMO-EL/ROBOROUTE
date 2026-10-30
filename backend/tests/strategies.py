"""Hypothesis strategies producing valid domain objects.

Every generated scenario satisfies the model's invariants by construction, so property tests can
focus on behaviour rather than on rejecting invalid input.
"""

from typing import Any

from hypothesis import strategies as st

from roboroute.engine.models import Scenario


def fl(low: float, high: float) -> st.SearchStrategy[float]:
    """Finite floats in [low, high]."""
    return st.floats(min_value=low, max_value=high, allow_nan=False, allow_infinity=False)


@st.composite
def scenario_payloads(draw: st.DrawFn, max_missions: int = 6) -> dict[str, Any]:
    width = draw(fl(0.5, 3.0))
    height = draw(fl(0.5, 2.0))
    resolution = draw(st.sampled_from([0.01, 0.02, 0.05]))

    def coord(limit: float) -> st.SearchStrategy[float]:
        return fl(0.0, limit)

    pose = st.fixed_dictionaries(
        {
            "x": coord(width),
            "y": coord(height),
            "theta": fl(-3.0, 3.0),
        }
    )
    n_obstacles = draw(st.integers(min_value=0, max_value=4))
    obstacles = []
    for i in range(n_obstacles):
        if draw(st.booleans()):
            shape = {
                "kind": "rect",
                "cx": draw(coord(width)),
                "cy": draw(coord(height)),
                "width": draw(fl(0.02, 0.5)),
                "height": draw(fl(0.02, 0.5)),
                "rotation": draw(fl(-3.0, 3.0)),
            }
        else:
            shape = {
                "kind": "circle",
                "cx": draw(coord(width)),
                "cy": draw(coord(height)),
                "radius": draw(fl(0.01, 0.3)),
            }
        obstacles.append({"id": f"o{i}", "label": f"Obstacle {i}", "kind": "solid", "shape": shape})

    duration = fl(0.0, 60.0)
    n_missions = draw(st.integers(min_value=0, max_value=max_missions))
    missions = []
    for i in range(n_missions):
        low, mode, high = sorted(draw(st.lists(duration, min_size=3, max_size=3)))
        missions.append(
            {
                "id": f"m{i}",
                "name": f"Mission {i}",
                "approach_pose": draw(pose),
                "execution_time": {"kind": "triangular", "low": low, "mode": mode, "high": high},
                "success": {"kind": "probability", "p": draw(fl(0.0, 1.0))},
                "max_attempts": draw(st.integers(min_value=1, max_value=3)),
            }
        )

    ids = [m["id"] for m in missions]
    constraints = []
    if len(ids) >= 2:
        a, b = draw(st.lists(st.sampled_from(ids), min_size=2, max_size=2, unique=True))
        constraints.append({"kind": "precedes", "before": a, "after": b})

    rules = [
        {"kind": "mission_points", "mission": mid, "points": draw(st.integers(0, 100))}
        for mid in ids
    ]

    return {
        "schema_version": 1,
        "id": "generated",
        "name": "Generated scenario",
        "fictional": True,
        "arena": {
            "width": width,
            "height": height,
            "grid_resolution": resolution,
            "obstacles": obstacles,
            "home_zones": [],
            "start_pose": draw(pose),
        },
        "robot": {
            "name": "Generated bot",
            "length": 0.2,
            "width": 0.15,
            "linear": {"max_speed": 0.3, "acceleration": 0.5},
            "angular": {"max_speed": 3.0},
        },
        "missions": missions,
        "constraints": constraints,
        "scoring": {"id": "generated-rules", "name": "Generated rules", "rules": rules},
        "format": {"kind": "single_run", "time_budget": 120.0},
    }


@st.composite
def scenarios(draw: st.DrawFn, max_missions: int = 6) -> Scenario:
    return Scenario.model_validate(draw(scenario_payloads(max_missions=max_missions)))
