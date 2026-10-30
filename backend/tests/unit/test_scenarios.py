import json
from pathlib import Path

import pytest

from roboroute.engine.scenarios import ScenarioLoadError, list_example_scenarios, load_scenario
from tests.paths import SCENARIOS_DIR


def test_example_directory_contains_scenario_a() -> None:
    ids = [s.id for s in list_example_scenarios(SCENARIOS_DIR)]
    assert "a-simple-arena" in ids


def test_examples_sorted_by_id() -> None:
    ids = [s.id for s in list_example_scenarios(SCENARIOS_DIR)]
    assert ids == sorted(ids)


@pytest.mark.parametrize("path", sorted(SCENARIOS_DIR.glob("*.json")), ids=lambda p: p.name)
def test_every_example_is_valid_and_fictional(path: Path) -> None:
    scenario = load_scenario(path)
    assert scenario.fictional is True
    assert scenario.id == path.stem


def test_invalid_file_raises_load_error_with_filename(tmp_path: Path) -> None:
    bad = tmp_path / "broken.json"
    bad.write_text(json.dumps({"schema_version": 1, "id": "broken"}), encoding="utf-8")
    with pytest.raises(ScenarioLoadError, match=r"broken\.json"):
        load_scenario(bad)


def test_non_json_file_raises_load_error(tmp_path: Path) -> None:
    bad = tmp_path / "garbage.json"
    bad.write_text("{not json", encoding="utf-8")
    with pytest.raises(ScenarioLoadError):
        load_scenario(bad)


@pytest.mark.parametrize("path", sorted(SCENARIOS_DIR.glob("*.json")), ids=lambda p: p.name)
def test_example_files_are_canonical(path: Path) -> None:
    """Files store exactly what the API serves, so the frontend can use them as fixtures.

    Regenerate with: uv run python scripts/canonicalize_scenarios.py
    """
    scenario = load_scenario(path)
    assert json.loads(path.read_text(encoding="utf-8")) == scenario.model_dump(mode="json")


@pytest.mark.parametrize("path", sorted(SCENARIOS_DIR.glob("*.json")), ids=lambda p: p.name)
def test_example_missions_reachable_from_start(path: Path) -> None:
    """Demo scenarios must be solvable: every mission can be reached from the start pose."""
    from roboroute.engine.travel.matrix import START, build_travel_matrix

    matrix = build_travel_matrix(load_scenario(path))
    unreachable = [f"{a}->{b}: {f.message}" for (a, b), f in matrix.failures.items() if a == START]
    assert unreachable == []
