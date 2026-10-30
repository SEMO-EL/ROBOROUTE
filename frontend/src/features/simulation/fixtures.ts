import type { SimulateResult } from "@/lib/api/endpoints";

const interval = (low: number, high: number) => ({ low, high });
const quantile = (q: number, v: number) => ({ q, estimate: v, interval: interval(v - 2, v + 2) });
const summary = (mean: number) => ({
  n: 1000,
  mean,
  mean_ci: interval(mean - 1.5, mean + 1.5),
  std: 30,
  minimum: 0,
  maximum: 160,
  quantiles: {
    p10: quantile(0.1, mean - 40),
    median: quantile(0.5, mean),
    p90: quantile(0.9, mean + 35),
    p95: quantile(0.95, mean + 40),
  },
});
const probability = (p: number) => ({ estimate: p, interval: interval(p - 0.03, p + 0.03) });

const plan = (label: string, mean: number, analytic: number, cut: number, target: number) => ({
  label,
  runs: [["beacon", "bridge"]],
  score: summary(mean),
  completion_time: summary(80),
  probability_cut_off: probability(cut),
  probability_skipped_for_time: probability(0),
  probability_target: probability(target),
  score_histogram: { edges: [0, 20, 40, 60], counts: [100, 300, 600] },
  completion_histogram: { edges: [60, 80, 100, 120], counts: [200, 500, 300] },
  score_ecdf: [
    [0, 0.1],
    [40, 0.4],
    [60, 1],
  ] as [number, number][],
  missions: [
    { mission: "beacon", started: probability(1), succeeded: probability(0.95) },
    { mission: "bridge", started: probability(0.9), succeeded: probability(0.72) },
  ],
  analytic_expected_score: analytic,
  planned_time: 78.5,
});

export const SIMULATE_RESULT: SimulateResult = {
  plans: [plan("Optimal", 127.5, 136.4, 0.125, 0.64), plan("Greedy", 130.4, 130.2, 0, 0.8)],
  differences: [
    {
      plan: "Greedy",
      reference: "Optimal",
      mean: 2.9,
      interval: interval(1.8, 4.0),
      share_better: 0.3,
      share_worse: 0.1,
    },
  ],
  metadata: {
    engine_version: "0.1.0",
    numpy_version: "2.5.4",
    seed: 7,
    trials: 1000,
    input_hash: "a".repeat(64),
  },
  assumptions: [
    "The buzzer is hard: a mission still in progress when time runs out scores nothing.",
  ],
  compute_seconds: 0.2,
};
