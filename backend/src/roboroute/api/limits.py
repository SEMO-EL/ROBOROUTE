"""ASGI middleware rejecting request bodies above a size limit.

Checks the declared Content-Length first, and also counts streamed bytes so that a client cannot
bypass the limit with chunked transfer encoding.
"""

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send


class BodyTooLargeError(Exception):
    pass


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        for name, value in scope.get("headers", []):
            if name == b"content-length" and value.isdigit() and int(value) > self.max_bytes:
                await self._reject(send)
                return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise BodyTooLargeError
            return message

        try:
            await self.app(scope, limited_receive, send)
        except BodyTooLargeError:
            await self._reject(send)

    async def _reject(self, send: Send) -> None:
        body = json.dumps(
            {
                "code": "payload_too_large",
                "message": f"Request body exceeds {self.max_bytes:,} bytes.",
                "details": None,
            }
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
