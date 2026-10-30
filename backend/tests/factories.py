"""Builders for valid scenario payloads used across tests.

Tests mutate copies of these dictionaries to produce exactly one defect at a time.
"""

import copy
from typing import Any


def scenario_dict() -> dict[str, Any]:
    """A small, valid, fictional scenario as raw JSON-compatible data."""
    return copy.deepcopy(
        {
            "schema_version": 1,
            "id": "test-scenario",
            "name": "Test scenario",
            "description": "Fictional data for tests.",
            "fictional": True,
            "arena": {
                "width": 2.0,
                "height": 1.2,
                "grid_resolution": 0.02,
                "obstacles": [
                    {
                        "id": "wall",
                        "label": "Wall",
                        "kind": "solid",
                        "shape": {
                            "kind": "rect",
                            "cx": 1.0,
                            "cy": 0.6,
                            "width": 0.1,
                            "height": 0.6,
                        },
                    },
                    {
                        "id": "post",
                        "label": "Post",
                        "kind": "solid",
                        "shape": {"kind": "circle", "cx": 1.5, "cy": 0.3, "radius": 0.05},
                    },
                ],
                "home_zones": [
                    {
                        "id": "home",
                        "label": "Home",
                        "shape": {
                            "kind": "rect",
                            "cx": 0.2,
                            "cy": 0.2,
                            "width": 0.4,
                            "height": 0.4,
                        },
                    }
                ],
                "start_pose": {"x": 0.2, "y": 0.2, "theta": 0.0},
            },
            "robot": {
                "name": "Test bot",
                "length": 0.20,
                "width": 0.15,
                "safety_margin": 0.0,
                "linear": {"max_speed": 0.3, "acceleration": 0.6, "provenance": "entered"},
                "angular": {"max_speed": 3.0, "acceleration": 6.0, "provenance": "entered"},
            },
            "missions": [
                {
                    "id": "m1",
                    "name": "Mission one",
                    "approach_pose": {"x": 0.5, "y": 0.9, "theta": 1.5707963267948966},
                    "execution_time": {"kind": "fixed", "value": 5.0},
                    "success": {"kind": "probability", "p": 0.9},
                },
                {
                    "id": "m2",
                    "name": "Mission two",
                    "approach_pose": {"x": 1.7, "y": 0.9, "theta": 0.0},
                    "execution_time": {"kind": "triangular", "low": 4.0, "mode": 6.0, "high": 10.0},
                    "success": {"kind": "counts", "successes": 8, "attempts": 10},
                    "max_attempts": 2,
                },
            ],
            "constraints": [
                {"kind": "requires", "before": "m1", "after": "m2", "semantics": "succeeded"}
            ],
            "scoring": {
                "id": "test-rules",
                "name": "Test rules",
                "rules": [
                    {"kind": "mission_points", "mission": "m1", "points": 20},
                    {"kind": "mission_points", "mission": "m2", "points": 35},
                    {"kind": "all_of_bonus", "missions": ["m1", "m2"], "points": 10},
                ],
            },
            "format": {"kind": "single_run", "time_budget": 120.0},
        }
    )
