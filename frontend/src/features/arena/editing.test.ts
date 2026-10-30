import { SCENARIO_A, SCENARIO_D } from "@/test/fixtures";

import {
  addMission,
  addObstacle,
  deleteSelection,
  moveSelection,
  setHeading,
  snap,
  uniqueId,
  updateMission,
  updateShape,
} from "./editing";

describe("editing operations", () => {
  it("creates ids that are unique across all objects", () => {
    expect(uniqueId(SCENARIO_A, "ridge")).toBe("ridge-1");
    expect(uniqueId(SCENARIO_A, "lever")).toBe("lever");
    expect(uniqueId(SCENARIO_A, "obstacle")).toBe("obstacle-1");
  });

  it("adds a rectangle obstacle centred on the click", () => {
    const { scenario, id } = addObstacle(SCENARIO_A, "solid", "rect", { x: 1.0, y: 0.5 });
    const obstacle = scenario.arena.obstacles.find((o) => o.id === id);
    expect(obstacle?.shape).toMatchObject({ kind: "rect", cx: 1.0, cy: 0.5 });
    expect(scenario.arena.obstacles).toHaveLength(SCENARIO_A.arena.obstacles.length + 1);
    expect(SCENARIO_A.arena.obstacles).toHaveLength(4); // the input is not mutated
  });

  it("adds a mission with a points rule", () => {
    const { scenario, id } = addMission(SCENARIO_A, { x: 0.5, y: 0.3 });
    expect(scenario.missions.find((m) => m.id === id)?.approach_pose).toEqual({ x: 0.5, y: 0.3, theta: 0 });
    expect(scenario.scoring.rules).toContainEqual({ kind: "mission_points", mission: id, points: 10 });
  });

  it("removes every reference when a mission is deleted", () => {
    const scenario = deleteSelection(SCENARIO_D, { kind: "mission", id: "bridge" });
    expect(scenario.missions.map((m) => m.id)).not.toContain("bridge");
    const json = JSON.stringify([scenario.constraints, scenario.scoring, scenario.travel_overrides]);
    expect(json).not.toContain('"bridge"');
    expect(scenario.constraints).toHaveLength(2); // ramp → bridge removed; key → gate and docks kept
  });

  it("deletes obstacles and zones", () => {
    const scenario = deleteSelection(SCENARIO_A, { kind: "obstacle", id: "tower" });
    expect(scenario.arena.obstacles.map((o) => o.id)).not.toContain("tower");
  });

  it("moves each kind of object", () => {
    const point = { x: 0.7, y: 0.4 };
    const movedObstacle = moveSelection(SCENARIO_A, { kind: "obstacle", id: "tower" }, point);
    expect(movedObstacle.arena.obstacles.find((o) => o.id === "tower")?.shape).toMatchObject({ cx: 0.7, cy: 0.4 });
    const movedMission = moveSelection(SCENARIO_A, { kind: "mission", id: "beacon" }, point);
    expect(movedMission.missions.find((m) => m.id === "beacon")?.approach_pose).toMatchObject(point);
    const movedStart = moveSelection(SCENARIO_A, { kind: "start" }, point);
    expect(movedStart.arena.start_pose).toMatchObject(point);
  });

  it("sets headings normalised to (−π, π]", () => {
    const scenario = setHeading(SCENARIO_A, { kind: "mission", id: "beacon" }, 3 * Math.PI);
    expect(scenario.missions.find((m) => m.id === "beacon")?.approach_pose.theta).toBeCloseTo(Math.PI);
  });

  it("updates shapes and missions immutably", () => {
    const scenario = updateShape(SCENARIO_A, "tower", { radius: 0.2 });
    expect(scenario.arena.obstacles.find((o) => o.id === "tower")?.shape).toMatchObject({ radius: 0.2 });
    const renamed = updateMission(SCENARIO_A, "beacon", { name: "Beacon!" });
    expect(renamed.missions.find((m) => m.id === "beacon")?.name).toBe("Beacon!");
    expect(SCENARIO_A.missions[0]?.name).toBe("Light the beacon");
  });

  it("snaps to a step", () => {
    expect(snap(0.123, 0.01)).toBeCloseTo(0.12);
    expect(snap(0.126, 0.01)).toBeCloseTo(0.13);
    expect(snap(0.126, 0)).toBe(0.126);
  });
});
