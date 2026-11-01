/**
 * Pure scenario edits. Every function returns a new scenario and never mutates its input, so the
 * project store can keep earlier versions for undo. Units are SI (metres, radians).
 */
import type { Scenario } from "@/lib/api/client";
import type { Vec2 } from "@/lib/geometry/viewport";

import type { Selection } from "./selection";

type Arena = Scenario["arena"];
type Obstacle = Arena["obstacles"][number];
type Mission = Scenario["missions"][number];
type Shape = Obstacle["shape"];

const TAU = 2 * Math.PI;

export function normalizeAngle(theta: number): number {
  let wrapped = theta % TAU;
  if (wrapped <= -Math.PI) wrapped += TAU;
  else if (wrapped > Math.PI) wrapped -= TAU;
  return wrapped;
}

export function snap(value: number, step: number): number {
  if (step <= 0) return value;
  return Number((Math.round(value / step) * step).toFixed(6));
}

function allIds(scenario: Scenario): Set<string> {
  return new Set([
    ...scenario.missions.map((m) => m.id),
    ...scenario.arena.obstacles.map((o) => o.id),
    ...scenario.arena.home_zones.map((z) => z.id),
    "start",
  ]);
}

const GENERIC_IDS = new Set(["obstacle", "mission", "keep-out", "zone"]);

/** `base` itself if it is free and specific; otherwise the first free base-1, base-2, … */
export function uniqueId(scenario: Scenario, base: string): string {
  const taken = allIds(scenario);
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .slice(0, 50) || "item";
  if (!taken.has(clean) && !GENERIC_IDS.has(clean)) return clean;
  for (let n = 1; ; n += 1) {
    const candidate = `${clean}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function withArena(scenario: Scenario, arena: Partial<Arena>): Scenario {
  return { ...scenario, arena: { ...scenario.arena, ...arena } };
}

export function addObstacle(
  scenario: Scenario,
  kind: "solid" | "no_go",
  shapeKind: "rect" | "circle",
  at: Vec2,
): { scenario: Scenario; id: string } {
  const id = uniqueId(scenario, kind === "no_go" ? "keep-out" : "obstacle");
  const shape: Shape =
    shapeKind === "rect"
      ? { kind: "rect", cx: at.x, cy: at.y, width: 0.2, height: 0.2, rotation: 0 }
      : { kind: "circle", cx: at.x, cy: at.y, radius: 0.1 };
  const count = scenario.arena.obstacles.length + 1;
  const obstacle: Obstacle = {
    id,
    label: kind === "no_go" ? `Keep-out ${count}` : `Obstacle ${count}`,
    kind,
    shape,
  };
  return {
    scenario: withArena(scenario, { obstacles: [...scenario.arena.obstacles, obstacle] }),
    id,
  };
}

export function newMission(id: string, at: Vec2, name: string): Mission {
  return {
    id,
    name,
    description: "",
    approach_pose: { x: at.x, y: at.y, theta: 0 },
    execution_time: { kind: "fixed", value: 5 },
    success: { kind: "probability", p: 0.9 },
    max_attempts: 1,
    retry_time: null,
    attachment: null,
  };
}

export function addMission(scenario: Scenario, at: Vec2): { scenario: Scenario; id: string } {
  const id = uniqueId(scenario, "mission");
  const mission = newMission(id, at, `Mission ${scenario.missions.length + 1}`);
  return {
    id,
    scenario: {
      ...scenario,
      missions: [...scenario.missions, mission],
      scoring: {
        ...scenario.scoring,
        rules: [...scenario.scoring.rules, { kind: "mission_points", mission: id, points: 10 }],
      },
    },
  };
}

export function deleteSelection(scenario: Scenario, selection: Selection): Scenario {
  if (!selection || selection.kind === "start") return scenario;
  const { id } = selection;
  if (selection.kind === "obstacle") {
    return withArena(scenario, { obstacles: scenario.arena.obstacles.filter((o) => o.id !== id) });
  }
  if (selection.kind === "zone") {
    return withArena(scenario, {
      home_zones: scenario.arena.home_zones.filter((z) => z.id !== id),
    });
  }
  // A mission: remove it and everything that names it, so the scenario stays valid.
  return {
    ...scenario,
    missions: scenario.missions.filter((m) => m.id !== id),
    constraints: scenario.constraints.filter((c) =>
      c.kind === "excludes" ? c.a !== id && c.b !== id : c.before !== id && c.after !== id,
    ),
    scoring: {
      ...scenario.scoring,
      rules: scenario.scoring.rules.filter((rule) =>
        rule.kind === "all_of_bonus" ? !rule.missions.includes(id) : rule.mission !== id,
      ),
    },
    travel_overrides: scenario.travel_overrides.filter(
      (o) => o.from_node !== id && o.to_node !== id,
    ),
  };
}

export function updateShape(
  scenario: Scenario,
  obstacleId: string,
  patch: Partial<Record<string, number>>,
): Scenario {
  return withArena(scenario, {
    obstacles: scenario.arena.obstacles.map((o) =>
      o.id === obstacleId ? { ...o, shape: { ...o.shape, ...patch } } : o,
    ),
  });
}

export function updateObstacle(
  scenario: Scenario,
  obstacleId: string,
  patch: Partial<Omit<Obstacle, "id" | "shape">>,
): Scenario {
  return withArena(scenario, {
    obstacles: scenario.arena.obstacles.map((o) => (o.id === obstacleId ? { ...o, ...patch } : o)),
  });
}

export function updateZone(
  scenario: Scenario,
  zoneId: string,
  patch: Partial<Record<string, number>>,
): Scenario {
  return withArena(scenario, {
    home_zones: scenario.arena.home_zones.map((z) =>
      z.id === zoneId ? { ...z, shape: { ...z.shape, ...patch } } : z,
    ),
  });
}

export function updateMission(
  scenario: Scenario,
  missionId: string,
  patch: Partial<Omit<Mission, "id">>,
): Scenario {
  return {
    ...scenario,
    missions: scenario.missions.map((m) => (m.id === missionId ? { ...m, ...patch } : m)),
  };
}

export function moveSelection(scenario: Scenario, selection: Selection, to: Vec2): Scenario {
  if (!selection) return scenario;
  switch (selection.kind) {
    case "start":
      return withArena(scenario, {
        start_pose: { ...scenario.arena.start_pose, x: to.x, y: to.y },
      });
    case "mission": {
      const mission = scenario.missions.find((m) => m.id === selection.id);
      if (!mission) return scenario;
      return updateMission(scenario, selection.id, {
        approach_pose: { ...mission.approach_pose, x: to.x, y: to.y },
      });
    }
    case "obstacle":
      return updateShape(scenario, selection.id, { cx: to.x, cy: to.y });
    case "zone":
      return updateZone(scenario, selection.id, { cx: to.x, cy: to.y });
  }
}

export function setHeading(scenario: Scenario, selection: Selection, theta: number): Scenario {
  const heading = normalizeAngle(theta);
  if (selection?.kind === "start") {
    return withArena(scenario, { start_pose: { ...scenario.arena.start_pose, theta: heading } });
  }
  if (selection?.kind === "mission") {
    const mission = scenario.missions.find((m) => m.id === selection.id);
    if (!mission) return scenario;
    return updateMission(scenario, selection.id, {
      approach_pose: { ...mission.approach_pose, theta: heading },
    });
  }
  return scenario;
}

/** Position of the selected object (its centre or pose), used as the drag origin. */
export function positionOf(scenario: Scenario, selection: Selection): Vec2 | null {
  if (!selection) return null;
  switch (selection.kind) {
    case "start":
      return { x: scenario.arena.start_pose.x, y: scenario.arena.start_pose.y };
    case "mission": {
      const pose = scenario.missions.find((m) => m.id === selection.id)?.approach_pose;
      return pose ? { x: pose.x, y: pose.y } : null;
    }
    case "obstacle": {
      const shape = scenario.arena.obstacles.find((o) => o.id === selection.id)?.shape;
      return shape ? { x: shape.cx, y: shape.cy } : null;
    }
    case "zone": {
      const shape = scenario.arena.home_zones.find((z) => z.id === selection.id)?.shape;
      return shape ? { x: shape.cx, y: shape.cy } : null;
    }
  }
}
