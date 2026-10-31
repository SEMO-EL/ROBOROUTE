import { SCENARIO_A } from "@/test/fixtures";

import {
  applyCalibration,
  MOTORS,
  removeTripTime,
  setTripTime,
  speedCeiling,
  updateProfile,
  updateRobot,
} from "./robot";

describe("robot editing", () => {
  it("updates dimensions immutably", () => {
    const scenario = updateRobot(SCENARIO_A, { length: 0.25 });
    expect(scenario.robot.length).toBe(0.25);
    expect(SCENARIO_A.robot.length).toBe(0.2);
  });

  it("marks hand-entered speeds as entered", () => {
    const scenario = updateProfile(SCENARIO_A, "linear", { max_speed: 0.3 });
    expect(scenario.robot.linear).toMatchObject({ max_speed: 0.3, provenance: "entered" });
  });

  it("applies a calibration result and records its provenance", () => {
    const scenario = applyCalibration(SCENARIO_A, "angular", {
      max_speed: 3.1,
      acceleration: null,
    });
    expect(scenario.robot.angular).toEqual({
      max_speed: 3.1,
      acceleration: null,
      provenance: "calibrated",
    });
  });

  it("computes the manufacturer speed ceiling from RPM and wheel diameter", () => {
    // 175 rpm × π × 0.056 m / 60 s ≈ 0.513 m/s.
    expect(speedCeiling(175, 0.056)).toBeCloseTo(0.5131, 4);
  });

  it("labels every motor reference with its source", () => {
    for (const motor of MOTORS) expect(motor.source.length).toBeGreaterThan(10);
  });
});

describe("measured trip times", () => {
  it("adds a trip time and replaces an existing one for the same direction", () => {
    const once = setTripTime(SCENARIO_A, "start", "beacon", 4.2);
    expect(once.travel_overrides).toEqual([
      { from_node: "start", to_node: "beacon", seconds: 4.2 },
    ]);
    const again = setTripTime(once, "start", "beacon", 3.9);
    expect(again.travel_overrides).toEqual([
      { from_node: "start", to_node: "beacon", seconds: 3.9 },
    ]);
    const reverse = setTripTime(again, "beacon", "start", 4.4);
    expect(reverse.travel_overrides).toHaveLength(2);
    expect(SCENARIO_A.travel_overrides).toEqual([]);
  });

  it("ignores a trip from a node to itself", () => {
    expect(setTripTime(SCENARIO_A, "beacon", "beacon", 2)).toBe(SCENARIO_A);
  });

  it("removes a trip time", () => {
    const scenario = setTripTime(
      setTripTime(SCENARIO_A, "start", "beacon", 4),
      "beacon",
      "bridge",
      5,
    );
    expect(removeTripTime(scenario, 0).travel_overrides).toEqual([
      { from_node: "beacon", to_node: "bridge", seconds: 5 },
    ]);
  });
});
