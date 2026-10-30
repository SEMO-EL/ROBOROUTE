import { SCENARIO_A } from "@/test/fixtures";

import { footprintRadius } from "./footprint";

it("matches the backend definition (half diagonal plus margin)", () => {
  const robot = { ...SCENARIO_A.robot, length: 0.2, width: 0.15, safety_margin: 0 };
  expect(footprintRadius(robot)).toBeCloseTo(0.125, 12);
  expect(footprintRadius({ ...robot, safety_margin: 0.01 })).toBeCloseTo(0.135, 12);
});
