from typing import Annotated, Any

from fastapi import APIRouter, Body
from pydantic import BaseModel, Field

from roboroute.engine.missions.validation import validate_constraints
from roboroute.engine.models import Issue
from roboroute.engine.models.validation import validate_scenario_payload

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


class ValidationReport(BaseModel):
    valid: bool = Field(description="True when there are no errors (warnings are allowed)")
    issues: list[Issue]


@router.post("/validate")
def validate_scenario(payload: Annotated[dict[str, Any], Body()]) -> ValidationReport:
    """Check a scenario and list every problem found: schema and reference errors first; for a
    well-formed scenario, constraint problems (cycles are errors, missions that can never be done
    are warnings).

    Always answers 200 for a JSON object, so the editor can show the issues next to the fields.
    """
    scenario, issues = validate_scenario_payload(payload)
    if scenario is not None:
        issues = validate_constraints(scenario)
    return ValidationReport(valid=all(i.severity != "error" for i in issues), issues=issues)
