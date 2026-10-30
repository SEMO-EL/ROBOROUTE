import platform

import numpy
from fastapi import APIRouter
from pydantic import BaseModel

import roboroute

router = APIRouter(tags=["meta"])


class Health(BaseModel):
    status: str


class VersionInfo(BaseModel):
    version: str
    python: str
    numpy: str


@router.get("/health")
def health() -> Health:
    return Health(status="ok")


@router.get("/version")
def version() -> VersionInfo:
    """Versions that affect numerical results; recorded with every experiment."""
    return VersionInfo(
        version=roboroute.__version__,
        python=platform.python_version(),
        numpy=numpy.__version__,
    )
