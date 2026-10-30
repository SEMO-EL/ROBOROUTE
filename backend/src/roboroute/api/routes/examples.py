from fastapi import APIRouter, Request
from pydantic import BaseModel

from roboroute.api.errors import ApiError
from roboroute.engine.models import Scenario

router = APIRouter(prefix="/examples", tags=["examples"])


class ExampleSummary(BaseModel):
    id: str
    name: str
    description: str


def _examples(request: Request) -> list[Scenario]:
    examples: list[Scenario] = request.app.state.examples
    return examples


@router.get("")
def list_examples(request: Request) -> list[ExampleSummary]:
    """Fictional demonstration scenarios shipped with RoboRoute."""
    return [
        ExampleSummary(id=s.id, name=s.name, description=s.description) for s in _examples(request)
    ]


@router.get("/{example_id}")
def get_example(example_id: str, request: Request) -> Scenario:
    for scenario in _examples(request):
        if scenario.id == example_id:
            return scenario
    raise ApiError(404, "not_found", f"No example scenario with id '{example_id}'.")
