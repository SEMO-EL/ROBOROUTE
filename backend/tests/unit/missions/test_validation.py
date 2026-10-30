from typing import Any

from roboroute.engine.missions.validation import requirement_closure, validate_constraints
from roboroute.engine.models import Scenario
from tests.factories import scenario_dict


def _with_missions(ids: list[str], constraints: list[dict[str, Any]]) -> Scenario:
    data = scenario_dict()
    template = data["missions"][0]
    data["missions"] = [{**template, "id": mid, "name": mid} for mid in ids]
    data["constraints"] = constraints
    data["scoring"]["rules"] = []
    return Scenario.model_validate(data)


def test_valid_constraints_have_no_issues() -> None:
    assert validate_constraints(Scenario.model_validate(scenario_dict())) == []


def test_cycle_reported_with_path() -> None:
    scenario = _with_missions(
        ["a", "b", "c"],
        [
            {"kind": "requires", "before": "a", "after": "b"},
            {"kind": "precedes", "before": "b", "after": "c"},
            {"kind": "requires", "before": "c", "after": "a"},
        ],
    )
    issues = validate_constraints(scenario)
    cycle = next(i for i in issues if i.code == "constraint_cycle")
    assert cycle.severity == "error"
    assert "a → b → c → a" in cycle.message


def test_contradictory_requirements() -> None:
    scenario = _with_missions(
        ["a", "b", "c", "d"],
        [
            {"kind": "requires", "before": "a", "after": "c"},
            {"kind": "requires", "before": "b", "after": "c"},
            {"kind": "excludes", "a": "a", "b": "b"},
            {"kind": "requires", "before": "c", "after": "d"},
        ],
    )
    issues = validate_constraints(scenario)
    impossible = {i.message.split("'")[1] for i in issues if i.code == "impossible_mission"}
    assert impossible == {"c", "d"}  # d inherits c's contradiction
    assert all(i.severity == "warning" for i in issues if i.code == "impossible_mission")


def test_mission_excluding_its_own_requirement() -> None:
    scenario = _with_missions(
        ["a", "b"],
        [
            {"kind": "requires", "before": "a", "after": "b"},
            {"kind": "excludes", "a": "a", "b": "b"},
        ],
    )
    issues = validate_constraints(scenario)
    assert [i.code for i in issues] == ["impossible_mission"]
    assert "'b'" in issues[0].message


def test_requirement_closure_is_transitive() -> None:
    scenario = _with_missions(
        ["a", "b", "c"],
        [
            {"kind": "requires", "before": "a", "after": "b"},
            {"kind": "requires", "before": "b", "after": "c"},
        ],
    )
    closure = requirement_closure(scenario)
    assert closure == {"a": set(), "b": {"a"}, "c": {"a", "b"}}
