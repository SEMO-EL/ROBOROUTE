import { recurrenceRows, type PlanStep } from "./dp";

const travel = (from: string, to: string, seconds: number): PlanStep => ({
  kind: "travel",
  from_node: from,
  to_node: to,
  seconds,
});
const mission = (id: string, seconds: number): PlanStep => ({
  kind: "mission",
  from_node: id,
  to_node: id,
  seconds,
});
const reset = (seconds: number): PlanStep => ({
  kind: "reset",
  from_node: "start",
  to_node: "start",
  seconds,
});

describe("recurrenceRows", () => {
  it("applies the DP recurrence step by step along a multi-run plan", () => {
    const rows = recurrenceRows([
      travel("start", "a", 4),
      mission("a", 6),
      travel("a", "start", 3),
      reset(5),
      travel("start", "b", 2),
      mission("b", 7),
      travel("b", "start", 3),
    ]);
    expect(rows.map((r) => [r.kind, r.from, r.at, r.previous, r.travel, r.work, r.total])).toEqual([
      ["mission", "start", "a", 0, 4, 6, 10],
      ["home", "a", "start", 10, 3, 5, 18],
      ["mission", "start", "b", 18, 2, 7, 27],
      ["finish", "b", "start", 27, 3, 0, 30],
    ]);
    expect(rows.map((r) => r.done)).toEqual([["a"], ["a"], ["a", "b"], ["a", "b"]]);
  });

  it("is empty for an empty plan", () => {
    expect(recurrenceRows([])).toEqual([]);
  });
});
