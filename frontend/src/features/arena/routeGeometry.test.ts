import { cellsToPath, pointsAttribute, runsToPath } from "./routeGeometry";

it("turns blocked runs into one SVG path of rectangles in arena units", () => {
  // Row 1, columns 2..4 (3 cells) with h = 0.1 → x from 0.2 to 0.5, y from 0.1 to 0.2.
  expect(runsToPath([[1, 2, 3]], 0.1)).toBe("M0.2 0.1h0.3v0.1h-0.3z");
});

it("draws explored cells as unit squares", () => {
  expect(
    cellsToPath(
      [
        [0, 0],
        [2, 1],
      ],
      0.5,
    ),
  ).toBe("M0 0h0.5v0.5h-0.5zM1 0.5h0.5v0.5h-0.5z");
});

it("formats polyline points", () => {
  expect(
    pointsAttribute([
      [0.2, 0.2],
      [1.1, 1],
    ]),
  ).toBe("0.2,0.2 1.1,1");
});
