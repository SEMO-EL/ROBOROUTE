import csv
import io
import json
from typing import Any

from fastapi.testclient import TestClient

from roboroute.api.csv_export import sanitize_cell
from tests.paths import SCENARIOS_DIR


def body(label: str = "Optimal", trials: int = 50) -> dict[str, Any]:
    scenario = json.loads((SCENARIOS_DIR / "a-simple-arena.json").read_text())
    return {
        "scenario": scenario,
        "plans": [{"label": label, "runs": [["beacon", "bridge"]]}],
        "config": {"trials": trials, "seed": 3},
    }


def rows(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text)))


def test_trials_csv_has_one_row_per_trial(client: TestClient) -> None:
    response = client.post("/api/v1/simulate/trials", json=body(trials=40))
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    table = rows(response.text)
    assert len(table) == 40
    assert set(table[0]) >= {
        "plan",
        "trial",
        "score",
        "completion_time_s",
        "cut_off",
        "beacon_succeeded",
    }


def test_trials_csv_is_reproducible(client: TestClient) -> None:
    first = client.post("/api/v1/simulate/trials", json=body()).text
    second = client.post("/api/v1/simulate/trials", json=body()).text
    assert first == second


def test_formula_like_labels_are_neutralised(client: TestClient) -> None:
    response = client.post("/api/v1/simulate/trials", json=body(label="=HYPERLINK(1)"))
    assert rows(response.text)[0]["plan"] == "'=HYPERLINK(1)"


def test_sanitize_cell() -> None:
    assert sanitize_cell("@SUM(A1)") == "'@SUM(A1)"
    assert sanitize_cell("+1") == "'+1"
    assert sanitize_cell("\tx") == "'\tx"
    assert sanitize_cell("normal") == "normal"
