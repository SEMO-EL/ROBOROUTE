import type { OptimizeResult } from "@/lib/api/endpoints";

const plan = (runs: string[][], expected: number, completion: number) => ({
  runs,
  expected_score: expected,
  completion_time: completion,
  steps: [
    {
      kind: "travel" as const,
      from_node: "start",
      to_node: runs[0]?.[0] ?? "start",
      seconds: 4,
      provenance: "modeled" as const,
    },
    {
      kind: "mission" as const,
      from_node: runs[0]?.[0] ?? "start",
      to_node: runs[0]?.[0] ?? "start",
      seconds: 6,
      provenance: "planned" as const,
    },
  ],
  route: [
    [
      [0.2, 0.2],
      [0.6, 0.6],
    ],
  ],
});

export const OPTIMIZE_RESULT: OptimizeResult = {
  candidates: ["beacon", "bridge", "crane"],
  excluded: [{ mission: "ghost", reason: "Mission 'ghost' needs 130.0 s even on its own." }],
  warnings: [],
  optimal: plan([["beacon", "bridge"]], 54.5, 47.2),
  alternatives: [plan([["bridge"]], 28, 30), plan([["beacon"]], 19, 12)],
  greedy: plan([["beacon"]], 19, 10),
  explanation: {
    budget: 120,
    completion_time: 47.2,
    slack: 72.8,
    travel_seconds: 20.1,
    mission_seconds: 27.1,
    reset_seconds: 0,
    expected_score: 54.5,
    verdicts: [
      {
        mission: "beacon",
        selected: true,
        reason: "Chosen: without it the best possible plan scores 35.5 expected points (-19.0).",
        counterfactual_score: 35.5,
        delta: -19,
      },
      {
        mission: "crane",
        selected: false,
        reason:
          "Left out: the best plan that includes it scores 50.0 expected points instead of 54.5 (-4.5); its time is better spent elsewhere.",
        counterfactual_score: 50,
        delta: -4.5,
      },
    ],
  },
  sensitivity: [
    {
      factor: 0.8,
      best_score: 40,
      completion_time: 50,
      runs: [["bridge"]],
      same_selection_as_baseline: false,
    },
    {
      factor: 1.2,
      best_score: 54.5,
      completion_time: 40,
      runs: [["beacon", "bridge"]],
      same_selection_as_baseline: true,
    },
  ],
  assumptions: ["Mission durations are the mean of each mission's time distribution."],
  compute_seconds: 0.12,
};
