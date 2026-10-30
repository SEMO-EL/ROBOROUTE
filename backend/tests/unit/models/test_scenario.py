from typing import Any

import pytest
from pydantic import ValidationError

from roboroute.engine.models import Scenario
from tests.factories import scenario_dict


def _issues(error: ValidationError) -> list[dict[str, Any]]:
    """Flatten reference issues reported by the scenario validator."""
    found: list[dict[str, Any]] = []
    for err in error.errors():
        ctx = err.get("ctx") or {}
        found.extend(ctx.get("issues", []))
    return found


def test_valid_scenario_parses() -> None:
    scenario = Scenario.model_validate(scenario_dict())
    assert [m.id for m in scenario.missions] == ["m1", "m2"]


def test_unknown_mission_reference_rejected() -> None:
    data = scenario_dict()
    data["constraints"][0]["after"] = "ghost"
    with pytest.raises(ValidationError) as excinfo:
        Scenario.model_validate(data)
    issues = _issues(excinfo.value)
    assert any(i["code"] == "unknown_mission" and "ghost" in i["message"] for i in issues)
    assert any(i["path"] == ["constraints", 0, "after"] for i in issues)


def test_unknown_mission_in_scoring_rejected() -> None:
    data = scenario_dict()
    data["scoring"]["rules"][2]["missions"] = ["m1", "nope"]
    with pytest.raises(ValidationError) as excinfo:
        Scenario.model_validate(data)
    assert any("nope" in i["message"] for i in _issues(excinfo.value))


def test_duplicate_ids_rejected() -> None:
    data = scenario_dict()
    data["missions"][1]["id"] = "m1"
    data["constraints"] = []
    data["scoring"]["rules"] = []
    with pytest.raises(ValidationError) as excinfo:
        Scenario.model_validate(data)
    assert any(i["code"] == "duplicate_id" and "m1" in i["message"] for i in _issues(excinfo.value))


def test_ids_unique_across_missions_and_arena_objects() -> None:
    data = scenario_dict()
    data["arena"]["obstacles"][0]["id"] = "m1"
    with pytest.raises(ValidationError) as excinfo:
        Scenario.model_validate(data)
    assert any(i["code"] == "duplicate_id" for i in _issues(excinfo.value))


def test_self_constraint_rejected() -> None:
    data = scenario_dict()
    data["constraints"].append({"kind": "excludes", "a": "m2", "b": "m2"})
    with pytest.raises(ValidationError) as excinfo:
        Scenario.model_validate(data)
    assert any(i["code"] == "self_constraint" for i in _issues(excinfo.value))


def test_approach_pose_outside_arena_rejected() -> None:
    data = scenario_dict()
    data["missions"][0]["approach_pose"]["x"] = 2.5
    with pytest.raises(ValidationError) as excinfo:
        Scenario.model_validate(data)
    assert any(i["code"] == "outside_arena" for i in _issues(excinfo.value))


def test_all_reference_problems_reported_together() -> None:
    data = scenario_dict()
    data["constraints"][0]["after"] = "ghost"
    data["scoring"]["rules"][0]["mission"] = "phantom"
    with pytest.raises(ValidationError) as excinfo:
        Scenario.model_validate(data)
    messages = " ".join(i["message"] for i in _issues(excinfo.value))
    assert "ghost" in messages
    assert "phantom" in messages


def test_grid_cell_limit_enforced() -> None:
    data = scenario_dict()
    data["arena"]["width"] = 10.0
    data["arena"]["height"] = 10.0
    data["arena"]["grid_resolution"] = 0.005  # 2000 x 2000 = 4,000,000 cells
    with pytest.raises(ValidationError, match="grid"):
        Scenario.model_validate(data)


def test_start_pose_outside_arena_rejected() -> None:
    data = scenario_dict()
    data["arena"]["start_pose"]["y"] = -0.1
    with pytest.raises(ValidationError):
        Scenario.model_validate(data)


def test_reset_time_only_for_multi_run() -> None:
    data = scenario_dict()
    data["format"] = {"kind": "single_run", "time_budget": 120, "reset_time": 5}
    with pytest.raises(ValidationError, match="reset_time"):
        Scenario.model_validate(data)


def test_unsupported_schema_version_rejected() -> None:
    data = scenario_dict()
    data["schema_version"] = 99
    with pytest.raises(ValidationError):
        Scenario.model_validate(data)
