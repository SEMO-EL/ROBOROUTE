/** Pure robot edits and reference data. */
import type { Scenario } from "@/lib/api/client";

type Robot = Scenario["robot"];
type Profile = Robot["linear"];

export function updateRobot(
  scenario: Scenario,
  patch: Partial<Omit<Robot, "linear" | "angular">>,
): Scenario {
  return { ...scenario, robot: { ...scenario.robot, ...patch } };
}

/** A value typed by the user: provenance becomes "entered". */
export function updateProfile(
  scenario: Scenario,
  which: "linear" | "angular",
  patch: Partial<Omit<Profile, "provenance">>,
): Scenario {
  return updateRobot(scenario, {
    [which]: { ...scenario.robot[which], ...patch, provenance: "entered" },
  });
}

/** Values fitted from the user's own measurements: provenance becomes "calibrated". */
export function applyCalibration(
  scenario: Scenario,
  which: "linear" | "angular",
  fit: { max_speed: number; acceleration: number | null },
): Scenario {
  return updateRobot(scenario, {
    [which]: { max_speed: fit.max_speed, acceleration: fit.acceleration, provenance: "calibrated" },
  });
}

export interface MotorReference {
  id: string;
  name: string;
  noLoadRpm: number;
  source: string;
}

/**
 * Manufacturer figures, used only as an upper bound ("the robot cannot drive faster than this").
 * Real robots are slower: load, battery level, power setting and acceleration code all matter.
 */
export const MOTORS: readonly MotorReference[] = [
  {
    id: "spike-large",
    name: "SPIKE Prime Large Angular Motor",
    noLoadRpm: 175,
    source: "LEGO Education fact sheet 45602: 175 RPM ±15 % with no load at 7.2 V",
  },
  {
    id: "spike-medium",
    name: "SPIKE Prime Medium Angular Motor",
    noLoadRpm: 185,
    source: "LEGO Education fact sheet 45603: 185 RPM ±15 % with no load at 7.2 V",
  },
  {
    id: "ev3-large",
    name: "EV3 Large Motor",
    noLoadRpm: 170,
    source:
      "160–170 RPM quoted from the 2013 LEGO product sheet by secondary sources (upper value used)",
  },
];

/** Top wheel-surface speed in m/s for a motor speed (RPM) and wheel diameter (m). */
export function speedCeiling(rpm: number, wheelDiameter: number): number {
  return (rpm / 60) * Math.PI * wheelDiameter;
}

/**
 * A stopwatch time for one trip (from → to), used instead of the modelled travel time. Times are
 * directional: the way back can differ. Setting a trip that already has a time replaces it.
 */
export function setTripTime(
  scenario: Scenario,
  from: string,
  to: string,
  seconds: number,
): Scenario {
  if (from === to) return scenario;
  const others = scenario.travel_overrides.filter(
    (o) => !(o.from_node === from && o.to_node === to),
  );
  return {
    ...scenario,
    travel_overrides: [...others, { from_node: from, to_node: to, seconds }],
  };
}

export function removeTripTime(scenario: Scenario, index: number): Scenario {
  return {
    ...scenario,
    travel_overrides: scenario.travel_overrides.filter((_, i) => i !== index),
  };
}
