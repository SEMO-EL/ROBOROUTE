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
    # Public deployments: heavy requests per client per minute, and how many run at once (0 = off).
    rate_limit_per_minute: int = 0
    max_concurrent_jobs: int = 0

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.environ.get("ROBOROUTE_CORS_ORIGINS", "http://localhost:5173")
        return cls(
            examples_dir=Path(os.environ.get("ROBOROUTE_EXAMPLES_DIR", _DEFAULT_EXAMPLES_DIR)),
            cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
            max_body_bytes=int(os.environ.get("ROBOROUTE_MAX_BODY_BYTES", "1000000")),
            static_dir=Path(static) if (static := os.environ.get("ROBOROUTE_STATIC_DIR")) else None,
            rate_limit_per_minute=int(os.environ.get("ROBOROUTE_RATE_LIMIT_PER_MINUTE", "0")),
            max_concurrent_jobs=int(os.environ.get("ROBOROUTE_MAX_CONCURRENT_JOBS", "0")),
        )
