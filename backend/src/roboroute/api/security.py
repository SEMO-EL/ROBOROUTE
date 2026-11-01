"""Security headers on every response.

The Content-Security-Policy allows only the app's own origin: no inline or third-party scripts.
The interactive API documentation (Swagger UI) loads its scripts from a CDN, so its page is the
one exception.
"""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

BASE_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
]


# frame-ancestors is kept apart: the GitHub Pages build puts BASE_POLICY in a <meta> tag, which
# cannot carry it.
CONTENT_SECURITY_POLICY = "; ".join([*BASE_POLICY, "frame-ancestors 'none'"])


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, csp_exempt: tuple[str, ...] = ()) -> None:
        self.app = app
        self.csp_exempt = csp_exempt
        self.csp = CONTENT_SECURITY_POLICY.encode()
        self.headers = [
            (b"x-content-type-options", b"nosniff"),
            (b"x-frame-options", b"DENY"),
            (b"referrer-policy", b"no-referrer"),
        ]

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        with_csp = not any(scope["path"].startswith(p) for p in self.csp_exempt)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(self.headers)
                if with_csp:
                    headers.append((b"content-security-policy", self.csp))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)
