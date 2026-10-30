"""Uniform error responses.

Every error leaves the API as ``{"code", "message", "details"}``. Internal exceptions are logged
server-side and reported to the client only as a generic message — never a stack trace.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("roboroute.api")


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    details: Any = None


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


def error_response(status: int, code: str, message: str, details: Any = None) -> JSONResponse:
    envelope = ErrorEnvelope(code=code, message=message, details=details)
    return JSONResponse(status_code=status, content=envelope.model_dump())


def _validation_details(exc: RequestValidationError) -> list[dict[str, Any]]:
    # Only location, message and type: echoing the offending input back is unnecessary and could
    # reflect large payloads.
    return [
        {"loc": list(err.get("loc", ())), "msg": err.get("msg", ""), "type": err.get("type", "")}
        for err in exc.errors()
    ]


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc.status, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _request_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(
            422, "invalid_request", "The request is not valid.", _validation_details(exc)
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return error_response(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return error_response(500, "internal_error", "An internal error occurred.")
