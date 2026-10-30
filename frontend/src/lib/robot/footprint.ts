import type { Scenario } from "@/lib/api/client";

/**
 * Radius of the circumscribed disc used for collision checking, plus the safety margin.
 * Mirrors `Robot.footprint_radius` in backend/src/roboroute/engine/models/robot.py.
 */
export function footprintRadius(robot: Scenario["robot"]): number {
  return 0.5 * Math.hypot(robot.length, robot.width) + robot.safety_margin;
}
