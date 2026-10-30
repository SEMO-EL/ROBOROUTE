import pytest
from fastapi.testclient import TestClient

from roboroute.api.app import create_app
from roboroute.api.settings import Settings
from tests.paths import SCENARIOS_DIR


@pytest.fixture
def settings() -> Settings:
    return Settings(
        examples_dir=SCENARIOS_DIR,
        cors_origins=("http://localhost:5173",),
        max_body_bytes=1_000_000,
    )


@pytest.fixture
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings), raise_server_exceptions=False)
