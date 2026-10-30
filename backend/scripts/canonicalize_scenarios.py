"""Rewrite every example scenario in canonical form (all defaults explicit, stable layout)."""

import json
from pathlib import Path

from roboroute.engine.scenarios import load_scenario

SCENARIOS_DIR = Path(__file__).resolve().parents[2] / "scenarios"


def main() -> None:
    for path in sorted(SCENARIOS_DIR.glob("*.json")):
        scenario = load_scenario(path)
        text = json.dumps(scenario.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n"
        path.write_text(text, encoding="utf-8")
        print(f"canonicalised {path.name}")


if __name__ == "__main__":
    main()
