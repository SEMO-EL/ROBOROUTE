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


def content_security_policy(frame_ancestors: tuple[str, ...] = ()) -> str:
    """The policy; ``frame_ancestors`` lists sites allowed to show the app in a frame (none by
    default; e.g. Hugging Face shows a Space inside its own page)."""
    frames = " ".join(["'self'", *frame_ancestors]) if frame_ancestors else "'none'"
    return "; ".join([*BASE_POLICY, f"frame-ancestors {frames}"])


class SecurityHeadersMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        csp_exempt: tuple[str, ...] = (),
        frame_ancestors: tuple[str, ...] = (),
    ) -> None:
        self.app = app
        self.csp_exempt = csp_exempt
        self.csp = content_security_policy(frame_ancestors).encode()
        self.headers = [
            (b"x-content-type-options", b"nosniff"),
            (b"referrer-policy", b"no-referrer"),
        ]
        if not frame_ancestors:
            # X-Frame-Options cannot name other sites, so it is only sent when framing is denied.
            self.headers.append((b"x-frame-options", b"DENY"))

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
