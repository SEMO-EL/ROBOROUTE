"""Serving the built single-page app in production (one container: API + SPA).

Starlette's StaticFiles resolves paths safely inside the directory; on top of it, any unknown
non-API path returns ``index.html`` so that client-side routes such as ``/learn`` work on reload,
while unknown ``/api/...`` paths keep their JSON 404.
"""

from typing import Any

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

# Vite puts content-hashed files under assets/: their content never changes for a given name.
IMMUTABLE = "public, max-age=31536000, immutable"


class SinglePageApp(StaticFiles):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(html=True, **kwargs)

    async def get_response(self, path: str, scope: Scope) -> Response:
        path = path.replace("\\", "/")  # StaticFiles gives OS separators; Windows uses "\\"
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        try:
            response = await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404 or path.startswith("assets/"):
                raise
            response = await super().get_response("index.html", scope)
            path = "index.html"
        is_asset = path.startswith("assets/") and response.status_code in (200, 304)
        response.headers["cache-control"] = IMMUTABLE if is_asset else "no-cache"
        return response
