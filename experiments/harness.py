"""Shared helpers for reproducible experiments: metadata capture, CSV output, timing.

Every run writes ``results/raw.csv`` (one row per measurement) and ``results/metadata.json``
(code version, environment, seed, configuration) next to the experiment's scripts, so that results
can be regenerated and audited. Nothing in an experiment write-up may come from anywhere else.
"""

import csv
import json
import platform
import statistics
import subprocess
import sys
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy
import scipy

import roboroute


def _cpu_model() -> str:
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or "unknown"


def _git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def metadata(seed: int, config: dict[str, Any]) -> dict[str, Any]:
    return {
        "timestamp_utc": datetime.now(UTC).isoformat(timespec="seconds"),
        "git_commit": _git("rev-parse", "HEAD"),
        "git_dirty": _git("status", "--porcelain") != "",
        "roboroute": roboroute.__version__,
        "python": sys.version.split()[0],
        "numpy": numpy.__version__,
        "scipy": scipy.__version__,
        "platform": platform.platform(),
        "cpu": _cpu_model(),
        "seed": seed,
        "config": config,
    }


def write_results(directory: Path, rows: list[dict[str, Any]], meta: dict[str, Any]) -> None:
    results = directory / "results"
    results.mkdir(parents=True, exist_ok=True)
    with (results / "raw.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    (results / "metadata.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(rows)} rows to {results / 'raw.csv'}")


def median_time(function: Callable[[], object], repeats: int) -> float:
    """Median wall-clock time of ``repeats`` calls after one warm-up call."""
    function()
    samples = []
    for _ in range(repeats):
        start = time.perf_counter()
        function()
        samples.append(time.perf_counter() - start)
    return statistics.median(samples)
