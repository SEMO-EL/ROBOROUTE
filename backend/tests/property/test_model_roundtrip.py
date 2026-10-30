from hypothesis import given, settings

from roboroute.engine.models import Scenario
from tests.strategies import scenarios


@settings(max_examples=150)
@given(scenarios())
def test_scenario_json_roundtrip_is_lossless(scenario: Scenario) -> None:
    restored = Scenario.model_validate_json(scenario.model_dump_json())
    assert restored == scenario


@settings(max_examples=50)
@given(scenarios())
def test_scenario_dump_is_stable(scenario: Scenario) -> None:
    # Serialising twice must give byte-identical output (needed for content hashing later).
    first = scenario.model_dump_json()
    second = Scenario.model_validate_json(first).model_dump_json()
    assert first == second
