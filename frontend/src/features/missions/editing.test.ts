import { SCENARIO_A, SCENARIO_D } from "@/test/fixtures";

import {
  addBonus,
  addConstraint,
  countsEstimate,
  pointsOf,
  penaltyOf,
  removeConstraint,
  removeRule,
  setFormat,
  setPenalty,
  setPoints,
} from "./editing";

describe("mission editing", () => {
  it("reads and sets mission points", () => {
    expect(pointsOf(SCENARIO_A, "bridge")).toBe(35);
    const scenario = setPoints(SCENARIO_A, "bridge", 50);
    expect(pointsOf(scenario, "bridge")).toBe(50);
    expect(
      scenario.scoring.rules.filter((r) => r.kind === "mission_points" && r.mission === "bridge"),
    ).toHaveLength(1);
  });

  it("adds a points rule when a mission has none", () => {
    const withoutRule = { ...SCENARIO_A, scoring: { ...SCENARIO_A.scoring, rules: [] } };
    expect(pointsOf(setPoints(withoutRule, "crane", 12), "crane")).toBe(12);
  });

  it("sets and clears a failure penalty", () => {
    const scenario = setPenalty(SCENARIO_A, "crane", 8);
    expect(penaltyOf(scenario, "crane")).toBe(8);
    expect(penaltyOf(setPenalty(scenario, "crane", 0), "crane")).toBe(0);
    expect(
      setPenalty(scenario, "crane", 0).scoring.rules.some((r) => r.kind === "failure_penalty"),
    ).toBe(false);
  });

  it("adds constraints without duplicates and removes them by index", () => {
    const constraint = { kind: "precedes" as const, before: "beacon", after: "crane" };
    const once = addConstraint(SCENARIO_A, constraint);
    expect(addConstraint(once, constraint).constraints).toHaveLength(1);
    expect(removeConstraint(once, 0).constraints).toHaveLength(0);
  });

  it("adds and removes bonuses", () => {
    const scenario = addBonus(SCENARIO_A, ["beacon", "crane"], 15);
    const index = scenario.scoring.rules.findIndex((r) => r.kind === "all_of_bonus");
    expect(scenario.scoring.rules[index]).toEqual({
      kind: "all_of_bonus",
      missions: ["beacon", "crane"],
      points: 15,
    });
    expect(removeRule(scenario, index).scoring.rules.some((r) => r.kind === "all_of_bonus")).toBe(
      false,
    );
  });

  it("switching to single run clears the reset time", () => {
    expect(SCENARIO_D.format.reset_time).toBeGreaterThan(0);
    const scenario = setFormat(SCENARIO_D, { kind: "single_run" });
    expect(scenario.format).toMatchObject({ kind: "single_run", reset_time: 0 });
  });

  it("estimates success from practice counts like the engine ((s+1)/(n+2))", () => {
    expect(countsEstimate(10, 10)).toBeCloseTo(11 / 12);
    expect(countsEstimate(0, 0)).toBeCloseTo(0.5);
  });
});
