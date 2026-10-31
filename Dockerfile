# RoboRoute: one container serving the API and the built web app on port 8000.
#   docker build -t roboroute .
#   docker run --rm -p 8000:8000 roboroute        → http://localhost:8000
# Base images can be pulled from a mirror if Docker Hub rate-limits you, e.g.
#   --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22.22-bookworm-slim
#   --build-arg PYTHON_IMAGE=mirror.gcr.io/library/python:3.13-slim-bookworm
ARG NODE_IMAGE=node:22.22-bookworm-slim
ARG PYTHON_IMAGE=python:3.13-slim-bookworm

# --- Frontend build -------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS frontend
WORKDIR /src/frontend
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
# Test fixtures import the example scenarios; tsc -b type-checks them during the build.
COPY scenarios/ /src/scenarios/
RUN pnpm build

# --- Backend dependencies -------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS backend
COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/src ./src
RUN uv sync --locked --no-dev --no-editable

# --- Runtime --------------------------------------------------------------------------------
FROM ${PYTHON_IMAGE}
RUN useradd --system --uid 10001 --no-create-home roboroute
WORKDIR /app
COPY --from=backend /app/.venv /app/.venv
COPY --from=frontend /src/frontend/dist /app/static
COPY scenarios /app/scenarios
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ROBOROUTE_STATIC_DIR=/app/static \
    ROBOROUTE_EXAMPLES_DIR=/app/scenarios \
    ROBOROUTE_CORS_ORIGINS=""
USER roboroute
EXPOSE 8000
# Hosting platforms such as Render choose the port through $PORT; 8000 otherwise. Behind a
# platform's proxy, set FORWARDED_ALLOW_IPS so client addresses come from X-Forwarded-For.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD ["sh", "-c", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:${PORT:-8000}/api/v1/health', timeout=2)\""]
CMD ["sh", "-c", "exec uvicorn roboroute.api.app:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
