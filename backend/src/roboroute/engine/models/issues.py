"""Structured validation issues shared by the engine and the API."""

from typing import Literal

from pydantic import Field

from roboroute.engine.models.base import StrictModel

IssuePath = list[str | int]


class Issue(StrictModel):
    code: str
    message: str
    path: IssuePath = Field(default_factory=list)
    severity: Literal["error", "warning"] = "error"
