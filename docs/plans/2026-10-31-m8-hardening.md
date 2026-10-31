# M8 — Hardening, accessibility, deployment, documentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RoboRoute runs as one container that a club or school can host, every page passes an
automated accessibility scan, the whole student workflow is covered by an end-to-end test, and the
documentation explains how to use and verify it.

**Spec:** design §3 (one container: FastAPI serves the built SPA), §11 (limits and security),
§12 item 6 (Playwright end-to-end tests), §13 (M8 exit: full regression green).

## Global Constraints
- Production = one process: FastAPI serves `/api/v1/*` and the built SPA from
  `ROBOROUTE_STATIC_DIR`; any other path returns `index.html` (client-side routing), but unknown
  `/api/...` paths still return the structured JSON 404.
- Security headers on every response, including a Content-Security-Policy that allows only the
  app's own origin (no inline scripts, no third-party hosts). The E2E run fails on any console error,
  so a CSP violation cannot go unnoticed.
- E2E tests run against the production build served by the backend (the same configuration as the
  container), not the Vite dev server.
- Accessibility: axe-core scan of every page with no serious or critical violations, plus keyboard
  operation of the main controls.

## Review Focus
1. `/api/does-not-exist` → JSON 404, not `index.html` (Task 1 test).
2. `/../../etc/passwd`-style paths cannot escape the static directory (Task 1 test).
3. The workflow test starts from a blank project and survives a page reload (Task 3).
4. The container runs as a non-root user and needs no secrets (Task 2).

### Task 1: Backend serves the SPA; security headers
### Task 2: Dockerfile (multi-stage, non-root, health check) and `.dockerignore`
### Task 3: Playwright E2E: the 10-step workflow — new project → arena (field, obstacle, missions)
→ mission details → robot calibration → optimise → simulate → save experiment → reload and
reproduce → export → Learn step-through
### Task 4: Accessibility scan of every page; fix findings
### Task 5: Route-level code splitting (the single bundle exceeds Vite's 500 kB warning)
### Task 6: Documentation — README (features, quick start, Docker, verification), user guide for
students and coaches, limits; CI job for E2E
### Task 7: Full regression and final summary
