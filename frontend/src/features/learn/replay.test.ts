import { pathFromTrace, replay, type TraceEvent } from "./replay";

const expand = (i: number, j: number, g: number, h: number): TraceEvent => ({
  kind: "expand",
  cell: [i, j],
  parent: null,
  g,
  h,
  f: g + h,
});
const push = (i: number, j: number, from: [number, number], g: number, h: number): TraceEvent => ({
  kind: "push",
  cell: [i, j],
  parent: from,
  g,
  h,
  f: g + h,
});

// A* from (0,0) to (2,0) on a tiny grid; unit costs.
const TRACE: TraceEvent[] = [
  expand(0, 0, 0, 2),
  push(1, 0, [0, 0], 1, 1),
  push(0, 1, [0, 0], 1, 2),
  expand(1, 0, 1, 1),
  push(2, 0, [1, 0], 2, 0),
  push(1, 1, [1, 0], 2, 1),
  expand(2, 0, 2, 0),
];

describe("trace replay", () => {
  it("shows the state after each expansion", () => {
    const state = replay(TRACE, 2);
    expect(state.totalSteps).toBe(3);
    expect(state.current?.cell).toEqual([1, 0]);
    expect(state.pushed.map((e) => e.cell)).toEqual([
      [2, 0],
      [1, 1],
    ]);
    expect(state.closed).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(state.open).toEqual([
      [0, 1],
      [2, 0],
      [1, 1],
    ]);
    expect(state.done).toBe(false);
  });

  it("starts with only the start cell in the frontier and ends at the goal", () => {
    const first = replay(TRACE, 0);
    expect(first.closed).toEqual([]);
    expect(first.open).toEqual([[0, 0]]);
    expect(first.current).toBeNull();
    const last = replay(TRACE, 99);
    expect(last.step).toBe(3);
    expect(last.done).toBe(true);
    expect(last.current?.cell).toEqual([2, 0]);
  });

  it("marks pushes that found a shorter route to a cell already in the frontier", () => {
    const trace = [
      expand(0, 0, 0, 2),
      push(1, 1, [0, 0], 3, 1),
      push(1, 0, [0, 0], 1, 1),
      expand(1, 0, 1, 1),
      push(1, 1, [1, 0], 2, 1),
    ];
    expect(replay(trace, 1).pushed.map((e) => e.improved)).toEqual([false, false]);
    const second = replay(trace, 2);
    expect(second.pushed.map((e) => [e.cell, e.improved])).toEqual([[[1, 1], true]]);
    expect(second.pushed[0]?.previousG).toBe(3);
  });

  it("reproduces the search path by following parents from the goal", () => {
    expect(pathFromTrace(TRACE, [2, 0])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
  });

  it("returns null when the goal was never reached", () => {
    expect(pathFromTrace(TRACE.slice(0, 3), [2, 0])).toBeNull();
  });
});
