"""The engine must stay a pure library: no web framework, no API layer.

This keeps the optimisation and simulation code independently testable and reusable
(CLI, notebooks, benchmarks) — a hard architectural requirement of the design.
"""

import ast
from pathlib import Path

import roboroute.engine

FORBIDDEN_PREFIXES = ("fastapi", "starlette", "uvicorn", "roboroute.api")
ENGINE_ROOT = Path(roboroute.engine.__file__).parent


def _imported_modules(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    modules: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module is not None and node.level == 0:
            modules.append(node.module)
    return modules


def test_engine_does_not_import_web_or_api_modules() -> None:
    violations = [
        f"{path.relative_to(ENGINE_ROOT)} imports {module}"
        for path in sorted(ENGINE_ROOT.rglob("*.py"))
        for module in _imported_modules(path)
        if module.startswith(FORBIDDEN_PREFIXES)
    ]
    assert violations == []


def test_boundary_check_detects_violation(tmp_path: Path) -> None:
    bad = tmp_path / "bad.py"
    bad.write_text("from fastapi import FastAPI\nimport roboroute.api.app\n", encoding="utf-8")
    modules = _imported_modules(bad)
    flagged = [m for m in modules if m.startswith(FORBIDDEN_PREFIXES)]
    assert flagged == ["fastapi", "roboroute.api.app"]
