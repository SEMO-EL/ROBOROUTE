from typing import Annotated, Any

from fastapi import APIRouter, Body
from pydantic import BaseModel

from roboroute.engine.models import Issue
from roboroute.engine.models.validation import validate_scenario_payload

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


class ValidationReport(BaseModel):
    valid: bool
    issues: list[Issue]


@router.post("/validate")
def validate_scenario(payload: Annotated[dict[str, Any], Body()]) -> ValidationReport:
    """Check a scenario and list every problem found.

    Always answers 200 for a JSON object, so the editor can show the issues next to the fields.
    """
    _, issues = validate_scenario_payload(payload)
    return ValidationReport(valid=not issues, issues=issues)
