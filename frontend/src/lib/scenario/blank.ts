import type { Scenario } from "@/lib/api/client";

/**
 * A new, empty project. Match lengths follow the competitions' published rules (FLL Challenge:
 * 2.5-minute matches with returns to home; WRO RoboMission: one 2-minute attempt). The field size is
 * only a starting point — users should set it to match their own table.
 */
export function blankScenario(kind: "single_run" | "multi_run"): Scenario {
  return {
    schema_version: 1,
    id: "my-field",
    name: kind === "multi_run" ? "My field (several runs)" : "My field (one run)",
    description: "",
    fictional: false,
    arena: {
      width: 2.36,
      height: 1.14,
      grid_resolution: 0.02,
      obstacles: [],
      home_zones: [
        {
          id: "home",
          label: "Home",
          shape: { kind: "rect", cx: 0.25, cy: 0.25, width: 0.45, height: 0.45, rotation: 0 },
        },
      ],
      start_pose: { x: 0.25, y: 0.25, theta: 0 },
    },
    robot: {
      name: "My robot",
      drive: "differential",
      length: 0.2,
      width: 0.16,
      safety_margin: 0.01,
      linear: { max_speed: 0.25, acceleration: 0.5, provenance: "entered" },
      // 150 °/s and 360 °/s²: round numbers in the units the Robot page shows.
      angular: {
        max_speed: (150 * Math.PI) / 180,
        acceleration: (360 * Math.PI) / 180,
        provenance: "entered",
      },
      can_reverse: true,
    },
    missions: [],
    constraints: [],
    scoring: { id: "my-rules", name: "My scoring rules", rules: [] },
    format:
      kind === "multi_run"
        ? { kind, time_budget: 150, reset_time: 5, must_end_in_home: false }
        : { kind, time_budget: 120, reset_time: 0, must_end_in_home: false },
    travel_overrides: [],
  };
}
