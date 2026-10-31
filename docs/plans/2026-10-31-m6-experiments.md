# M6 — Projects, experiments, import/export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Work survives a reload; simulation runs can be saved as experiments, reproduced exactly,
compared, and exported (JSON for everything, CSV for per-trial results).

**Spec:** design §3 (local-first storage, reproducibility over storage), §11 (import validation,
CSV formula-injection protection).

## Global Constraints
- Local-first: projects and experiments live in the browser behind a `Repository` interface; the
  backend stays stateless. v1 uses `localStorage` (documents are small: a scenario is tens of kB and
  experiments store summaries, not raw trials).
- Every file RoboRoute writes is versioned: `{"format": "roboroute-project" | "roboroute-experiment",
  "schema_version": 1, ...}`. Import checks format, version (migrations registry) and size (1 MB),
  then validates the scenario with the backend.
- Raw per-trial data is regenerated deterministically (same inputs + seed) instead of stored; CSV is
  produced by the backend, which sanitises cells that a spreadsheet could execute
  (`=`, `+`, `-`, `@`, tab, carriage return).
- Storage failures (private mode, quota) are reported, never swallowed.

## Review Focus
1. Corrupted entry in storage → skipped with a warning; other projects still load (Task 1 test).
2. Importing a file from a newer schema version → clear refusal naming the version (Task 2 test).
3. Plan label starting with "=" → CSV cell is neutralised (Task 3 test).
4. Re-running a saved experiment → identical results and the same input hash (Task 5 test).
5. Storage quota exceeded on save → visible error, current work kept in memory (Task 1 test).

### Task 1: Repository + autosave — `lib/storage/{repository,local}.ts`, project store integration
### Task 2: Versioned file formats, import/export — `lib/storage/files.ts`
### Task 3: Backend `POST /simulate/trials` (CSV, sanitised)
### Task 4: Projects on the Overview page (open, duplicate, delete with confirmation, import, export)
### Task 5: Experiments page (save from Simulation, list, reproduce, compare, export JSON/CSV)
### Task 6: Overview status tiles from the latest strategy and simulation
