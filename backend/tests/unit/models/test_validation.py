from roboroute.engine.models.validation import validate_scenario_payload
from tests.factories import scenario_dict


def test_valid_payload_returns_scenario_and_no_issues() -> None:
    scenario, issues = validate_scenario_payload(scenario_dict())
    assert scenario is not None
    assert issues == []


def test_reference_issues_are_expanded() -> None:
    data = scenario_dict()
    data["constraints"][0]["before"] = "ghost"
    data["scoring"]["rules"][0]["mission"] = "phantom"
    scenario, issues = validate_scenario_payload(data)
    assert scenario is None
    assert {i.code for i in issues} == {"unknown_mission"}
    assert len(issues) == 2


def test_field_error_becomes_issue_with_path() -> None:
    data = scenario_dict()
    data["format"]["time_budget"] = 0
    _, issues = validate_scenario_payload(data)
    assert [i.path for i in issues] == [["format", "time_budget"]]


def test_non_object_payload_is_an_issue() -> None:
    scenario, issues = validate_scenario_payload("nope")
    assert scenario is None
    assert len(issues) == 1
