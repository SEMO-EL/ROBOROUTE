"""Serve the API inside the browser (Pyodide in a Web Worker) instead of over HTTP.

The worker passes each request from the web app to ``handle``, which runs it through the same
FastAPI application as the server: validation, error envelopes, limits and CSV export are
identical. Only the transport differs.
"""

from collections.abc import Sequence
from typing import Any
from urllib.parse import urlsplit

import anyio.to_thread
from starlette.types import ASGIApp, Message


async def _call_inline(func: Any, *args: Any, **_: Any) -> Any:
    return func(*args)


def run_without_threads() -> None:
    """Pyodide has no threads: run the work FastAPI hands to its thread pool (synchronous
    endpoints, response validation) directly on the event loop instead."""
    anyio.to_thread.run_sync = _call_inline  # type: ignore[assignment]


async def handle(
    app: ASGIApp, method: str, url: str, headers: Sequence[Sequence[str]], body: bytes
) -> tuple[int, list[tuple[str, str]], bytes]:
    """One HTTP exchange through the ASGI app; returns (status, headers, body)."""
    parts = urlsplit(url)
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "https",
        "path": parts.path,
        "raw_path": parts.path.encode(),
        "query_string": parts.query.encode(),
        "root_path": "",
        "headers": [(k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in headers],
        "client": ("browser", 0),
        "server": ("browser", 443),
    }
    pending = [{"type": "http.request", "body": bytes(body), "more_body": False}]
    status = 500
    response_headers: list[tuple[str, str]] = []
    chunks: list[bytes] = []

    async def receive() -> Message:
        return pending.pop() if pending else {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        nonlocal status, response_headers
        if message["type"] == "http.response.start":
            status = message["status"]
            response_headers = [
                (k.decode("latin-1"), v.decode("latin-1")) for k, v in message.get("headers", [])
            ]
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    await app(scope, receive, send)
    return status, response_headers, b"".join(chunks)
