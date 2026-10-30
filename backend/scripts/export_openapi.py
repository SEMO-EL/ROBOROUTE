"""Write the API's OpenAPI schema to a file (default: frontend/src/lib/api/openapi.json).

The frontend's TypeScript types are generated from this file, so Pydantic models stay the single
source of truth for every data contract.
"""

import json
import sys
from pathlib import Path

from roboroute.api.app import create_app

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "frontend" / "src" / "lib" / "api" / "openapi.json"


def main() -> None:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    output.parent.mkdir(parents=True, exist_ok=True)
    schema = create_app().openapi()
    output.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {output.relative_to(REPO_ROOT) if output.is_relative_to(REPO_ROOT) else output}")


if __name__ == "__main__":
    main()
