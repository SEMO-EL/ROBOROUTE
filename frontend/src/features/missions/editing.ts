/** Pure edits of scoring rules, constraints and the match format. */
import type { Scenario } from "@/lib/api/client";

type Rule = Scenario["scoring"]["rules"][number];
type Constraint = Scenario["constraints"][number];
type Format = Scenario["format"];

function withRules(scenario: Scenario, rules: Rule[]): Scenario {
  return { ...scenario, scoring: { ...scenario.scoring, rules } };
}

export function pointsOf(scenario: Scenario, missionId: string): number {
  return scenario.scoring.rules.reduce(
    (sum, rule) =>
      rule.kind === "mission_points" && rule.mission === missionId ? sum + rule.points : sum,
    0,
  );
}

export function penaltyOf(scenario: Scenario, missionId: string): number {
  return scenario.scoring.rules.reduce(
    (sum, rule) =>
      rule.kind === "failure_penalty" && rule.mission === missionId ? sum + rule.points : sum,
    0,
  );
}

/** Replace all points rules of the mission by one rule with `points`. */
export function setPoints(scenario: Scenario, missionId: string, points: number): Scenario {
  const rules = scenario.scoring.rules.filter(
    (r) => !(r.kind === "mission_points" && r.mission === missionId),
  );
  return withRules(scenario, [...rules, { kind: "mission_points", mission: missionId, points }]);
}

/** Replace the mission's failure penalty; 0 removes it. */
export function setPenalty(scenario: Scenario, missionId: string, points: number): Scenario {
  const rules = scenario.scoring.rules.filter(
    (r) => !(r.kind === "failure_penalty" && r.mission === missionId),
  );
  return withRules(
    scenario,
    points > 0 ? [...rules, { kind: "failure_penalty", mission: missionId, points }] : rules,
  );
}

export function addBonus(scenario: Scenario, missions: string[], points: number): Scenario {
  return withRules(scenario, [
    ...scenario.scoring.rules,
    { kind: "all_of_bonus", missions, points },
  ]);
}

export function removeRule(scenario: Scenario, index: number): Scenario {
  return withRules(
    scenario,
    scenario.scoring.rules.filter((_, i) => i !== index),
  );
}

export function addConstraint(scenario: Scenario, constraint: Constraint): Scenario {
  const key = JSON.stringify(constraint);
  if (scenario.constraints.some((c) => JSON.stringify(c) === key)) return scenario;
  return { ...scenario, constraints: [...scenario.constraints, constraint] };
}

export function removeConstraint(scenario: Scenario, index: number): Scenario {
  return { ...scenario, constraints: scenario.constraints.filter((_, i) => i !== index) };
}

export function setFormat(scenario: Scenario, patch: Partial<Format>): Scenario {
  const format = { ...scenario.format, ...patch };
  // The backend rejects a reset time in single-run formats (there are no returns home).
  if (format.kind === "single_run") format.reset_time = 0;
  return { ...scenario, format };
}

/**
 * Point estimate of the per-attempt success probability from practice counts, as used by the
 * engine (`CountsSuccess.point_estimate`): (s + 1) / (n + 2), Laplace's rule of succession.
 */
export function countsEstimate(successes: number, attempts: number): number {
  return (successes + 1) / (attempts + 2);
}
