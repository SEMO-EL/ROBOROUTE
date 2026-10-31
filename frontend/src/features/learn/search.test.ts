import { heuristicWorking, parseAlgorithm } from "./search";

describe("parseAlgorithm", () => {
  it("reads the algorithm name the backend reports", () => {
    expect(parseAlgorithm("astar[octile,8]")).toEqual({
      algorithm: "astar",
      heuristic: "octile",
      connectivity: 8,
    });
    expect(parseAlgorithm("astar[manhattan,4]")).toEqual({
      algorithm: "astar",
      heuristic: "manhattan",
      connectivity: 4,
    });
    expect(parseAlgorithm("dijkstra[8]")).toEqual({
      algorithm: "dijkstra",
      heuristic: "zero",
      connectivity: 8,
    });
  });

  it("returns null for names it does not know", () => {
    expect(parseAlgorithm("bfs")).toBeNull();
    expect(parseAlgorithm("astar[magic,8]")).toBeNull();
    expect(parseAlgorithm("astar[octile,6]")).toBeNull();
  });
});

describe("heuristicWorking", () => {
  // Same formulas as backend engine/pathfinding/heuristics.py; Δx = 3, Δy = 1, cell = 2 cm.
  const h = 0.02;
  it.each([
    ["octile", h * (2 + Math.SQRT2)],
    ["euclidean", h * Math.hypot(3, 1)],
    ["manhattan", h * 4],
    ["zero", 0],
  ] as const)("%s", (heuristic, expected) => {
    const working = heuristicWorking(heuristic, [5, 2], [8, 3], h);
    expect(working.dx).toBe(3);
    expect(working.dy).toBe(1);
    expect(working.value).toBeCloseTo(expected, 12);
  });

  it("writes the calculation out", () => {
    expect(heuristicWorking("octile", [5, 2], [8, 3], h).formula).toBe("2 cm × ((3 − 1) + √2 × 1)");
    expect(heuristicWorking("zero", [5, 2], [8, 3], h).formula).toBe("0 (Dijkstra)");
  });
});
