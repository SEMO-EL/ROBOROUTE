#!/usr/bin/env bash
# Regenerate the OpenAPI schema and TypeScript types, then fail if they differ from the
# committed versions. Keeps frontend types in lock-step with the backend's Pydantic models.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
(cd "$ROOT/backend" && uv run python scripts/export_openapi.py)
(cd "$ROOT/frontend" && pnpm -s gen:api)
if ! git -C "$ROOT" diff --exit-code -- frontend/src/lib/api; then
  echo "Generated API types are stale: run scripts/check-api-types.sh and commit the result." >&2
  exit 1
fi
echo "API types are up to date."
