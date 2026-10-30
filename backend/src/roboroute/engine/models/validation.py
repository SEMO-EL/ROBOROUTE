"""Turn arbitrary input into either a validated Scenario or a list of user-facing issues."""

from typing import Any

from pydantic import ValidationError

from roboroute.engine.models.issues import Issue
from roboroute.engine.models.scenario import Scenario


def validate_scenario_payload(payload: object) -> tuple[Scenario | None, list[Issue]]:
    """Validate raw (already JSON-decoded) data.

    Returns ``(scenario, [])`` on success and ``(None, issues)`` otherwise. Referential problems
    found by the scenario validator are expanded into one issue each, so the UI can point at
    every offending field.
    """
    if not isinstance(payload, dict):
        return None, [Issue(code="not_an_object", message="a scenario must be a JSON object")]
    try:
        return Scenario.model_validate(payload), []
    except ValidationError as exc:
        return None, issues_from_validation_error(exc)


def issues_from_validation_error(exc: ValidationError) -> list[Issue]:
    issues: list[Issue] = []
    for error in exc.errors(include_url=False):
        ctx: dict[str, Any] = error.get("ctx") or {}
        if error["type"] == "scenario_references" and "issues" in ctx:
            issues.extend(Issue.model_validate(raw) for raw in ctx["issues"])
        else:
            issues.append(Issue(code=error["type"], message=error["msg"], path=list(error["loc"])))
    return issues
