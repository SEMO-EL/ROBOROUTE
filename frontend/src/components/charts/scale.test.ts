import { linearScale, niceTicks } from "./scale";

it("maps a domain linearly onto a range", () => {
  const x = linearScale([0, 100], [0, 500]);
  expect(x(0)).toBe(0);
  expect(x(50)).toBe(250);
  expect(x(100)).toBe(500);
});

it("handles an empty domain without dividing by zero", () => {
  expect(linearScale([5, 5], [0, 100])(5)).toBe(50);
});

it("picks round tick values that cover the domain", () => {
  expect(niceTicks(0, 137, 5)).toEqual([0, 20, 40, 60, 80, 100, 120, 140]);
  expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
});
