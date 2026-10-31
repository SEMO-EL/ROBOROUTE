#!/usr/bin/env bash
# Assemble a Hugging Face Space (Docker) from the committed sources: what the image needs, a
# README whose header configures the Space, and the settings for a public site. Used by
# .github/workflows/deploy-space.yml; run locally to inspect what would be deployed.
#   ./scripts/assemble-space.sh <output-directory> [git-ref]
set -euo pipefail
OUT="${1:?usage: assemble-space.sh <output-directory> [git-ref]}"
REF="${2:-HEAD}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

rm -rf "$OUT"
mkdir -p "$OUT"
git -C "$ROOT" archive "$REF" Dockerfile .dockerignore LICENSE backend frontend scenarios \
  | tar -x -C "$OUT"
# Tests are not part of the image; leaving them out keeps the Space small.
rm -rf "$OUT/backend/tests" "$OUT/frontend/e2e"

# Settings for a public site behind Hugging Face's proxy (appended to the runtime stage).
cat >> "$OUT/Dockerfile" <<'SETTINGS'

# --- Hugging Face Space settings (added by scripts/assemble-space.sh) ----------------------
ENV PORT=7860 \
    FORWARDED_ALLOW_IPS="*" \
    ROBOROUTE_RATE_LIMIT_PER_MINUTE=60 \
    ROBOROUTE_MAX_CONCURRENT_JOBS=2 \
    ROBOROUTE_FRAME_ANCESTORS="https://huggingface.co"
EXPOSE 7860
SETTINGS

cat > "$OUT/README.md" <<'README'
---
title: RoboRoute
emoji: 🤖
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Strategy planning for student robotics competitions
---

# RoboRoute

Route planning, optimal mission selection and Monte Carlo simulation for student robotics
competitions (FIRST LEGO League Challenge, WRO RoboMission and similar robot games).

This Space is deployed automatically from the source repository: https://github.com/SEMO-EL/ROBOROUTE
Your projects are saved in your own browser; nothing is stored on this server.
README
echo "Space assembled in $OUT ($(find "$OUT" -type f | wc -l) files)"
