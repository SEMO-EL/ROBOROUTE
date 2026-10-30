import { niceScaleLength } from "./scaleBar";

it("picks the longest nice length that fits", () => {
  expect(niceScaleLength(500, 140)).toBe(0.2); // 0.2 m = 100 px; 0.5 m = 250 px is too long
  expect(niceScaleLength(100, 140)).toBe(1);
  expect(niceScaleLength(100000, 140)).toBe(0.01);
});
