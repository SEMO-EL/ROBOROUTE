/**
 * Mission time distributions for display. Means mirror `mean()` of the backend models and the
 * descriptions match how the simulator samples them (engine/simulation/sampling.py).
 */
import type { Model } from "@/lib/api/client";

export type Distribution =
  Model<"Fixed"> | Model<"Triangular"> | Model<"LogNormal"> | Model<"Empirical">;

export function distributionMean(d: Distribution): number {
  switch (d.kind) {
    case "fixed":
      return d.value;
    case "triangular":
      return (d.low + d.mode + d.high) / 3;
    case "lognormal":
      return d.median * Math.exp(Math.log(d.gsd) ** 2 / 2);
    case "empirical":
      return d.samples.reduce((a, b) => a + b, 0) / Math.max(1, d.samples.length);
  }
}

const s = (seconds: number) => `${seconds.toFixed(1)} s`;

export function describeDistribution(d: Distribution): string {
  switch (d.kind) {
    case "fixed":
      return `always ${s(d.value)}`;
    case "triangular":
      return `triangular: best ${s(d.low)}, usual ${s(d.mode)}, worst ${s(d.high)}`;
    case "lognormal":
      return `lognormal: typical ${s(d.median)}, spread ×${d.gsd.toFixed(2)}`;
    case "empirical":
      return `one of ${String(d.samples.length)} measured times, picked at random`;
  }
}
