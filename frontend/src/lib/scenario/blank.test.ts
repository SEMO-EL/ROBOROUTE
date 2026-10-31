import { blankScenario } from "./blank";

describe("blankScenario", () => {
  it("creates an FLL-style multi-run field", () => {
    const scenario = blankScenario("multi_run");
    expect(scenario.format).toEqual({
      kind: "multi_run",
      time_budget: 150,
      reset_time: 5,
      must_end_in_home: false,
    });
    expect(scenario.missions).toEqual([]);
    expect(scenario.fictional).toBe(false);
  });

  it("creates a WRO-style single-run field without a reset time", () => {
    const scenario = blankScenario("single_run");
    expect(scenario.format).toMatchObject({ kind: "single_run", time_budget: 120, reset_time: 0 });
  });

  it("puts the start pose inside the home zone and inside the field", () => {
    const { arena } = blankScenario("multi_run");
    const zone = arena.home_zones[0]?.shape;
    expect(zone).toBeDefined();
    if (!zone) return;
    expect(Math.abs(arena.start_pose.x - zone.cx)).toBeLessThan(zone.width / 2);
    expect(Math.abs(arena.start_pose.y - zone.cy)).toBeLessThan(zone.height / 2);
    expect(arena.start_pose.x).toBeLessThan(arena.width);
  });
});
