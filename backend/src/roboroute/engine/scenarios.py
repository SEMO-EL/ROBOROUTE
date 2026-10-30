"""Loading scenario files from disk."""

from pathlib import Path

from pydantic import ValidationError

from roboroute.engine.models import Scenario

MAX_SCENARIO_BYTES = 1_000_000


class ScenarioLoadError(ValueError):
    """A scenario file could not be read or did not satisfy the schema."""


def load_scenario(path: Path) -> Scenario:
    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise ScenarioLoadError(f"{path.name}: cannot read file ({exc.strerror})") from exc
    if len(raw) > MAX_SCENARIO_BYTES:
        raise ScenarioLoadError(f"{path.name}: file exceeds {MAX_SCENARIO_BYTES:,} bytes")
    try:
        return Scenario.model_validate_json(raw)
    except ValidationError as exc:
        raise ScenarioLoadError(
            f"{path.name}: {exc.error_count()} validation error(s)\n{exc}"
        ) from exc


def list_example_scenarios(directory: Path) -> list[Scenario]:
    """Load every ``*.json`` scenario in ``directory``, sorted by scenario id."""
    scenarios = [load_scenario(path) for path in directory.glob("*.json")]
    return sorted(scenarios, key=lambda s: s.id)
