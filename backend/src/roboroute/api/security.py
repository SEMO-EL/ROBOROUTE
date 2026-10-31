"""Security headers on every response.

The Content-Security-Policy allows only the app's own origin: no inline or third-party scripts.
The interactive API documentation (Swagger UI) loads its scripts from a CDN, so its page is the
one exception.
"""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ]
)

HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
]


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, csp_exempt: tuple[str, ...] = ()) -> None:
        self.app = app
        self.csp_exempt = csp_exempt

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        with_csp = not any(scope["path"].startswith(p) for p in self.csp_exempt)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(HEADERS)
                if with_csp:
                    headers.append((b"content-security-policy", CONTENT_SECURITY_POLICY.encode()))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)
