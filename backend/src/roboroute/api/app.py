"""FastAPI application factory. The API is a thin, stateless layer over roboroute.engine."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import roboroute
from roboroute.api.errors import install_error_handlers
from roboroute.api.limits import BodySizeLimitMiddleware
from roboroute.api.routes import (
    calibration,
    examples,
    meta,
    optimize,
    routing,
    scenarios,
    simulate,
)
from roboroute.api.settings import Settings
from roboroute.engine.scenarios import list_example_scenarios

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    app = FastAPI(
        title="RoboRoute API",
        version=roboroute.__version__,
        description="Route planning, strategy optimisation and simulation for robot games.",
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
    )
    app.state.examples = list_example_scenarios(settings.examples_dir)

    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["content-type"],
    )
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)

    for module in (meta, examples, scenarios, routing, calibration, optimize, simulate):
        app.include_router(module.router, prefix=API_PREFIX)
    return app


app = create_app()
