"""Runtime configuration, read from environment variables."""

import os
from dataclasses import dataclass
from pathlib import Path

# backend/src/roboroute/api/settings.py → repository root is four levels up.
_DEFAULT_EXAMPLES_DIR = Path(__file__).resolve().parents[4] / "scenarios"


@dataclass(frozen=True)
class Settings:
    examples_dir: Path
    cors_origins: tuple[str, ...]
    max_body_bytes: int = 1_000_000
    # Built frontend (frontend/dist) to serve alongside the API; None serves the API only.
    static_dir: Path | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.environ.get("ROBOROUTE_CORS_ORIGINS", "http://localhost:5173")
        return cls(
            examples_dir=Path(os.environ.get("ROBOROUTE_EXAMPLES_DIR", _DEFAULT_EXAMPLES_DIR)),
            cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
            max_body_bytes=int(os.environ.get("ROBOROUTE_MAX_BODY_BYTES", "1000000")),
            static_dir=Path(static) if (static := os.environ.get("ROBOROUTE_STATIC_DIR")) else None,
        )
