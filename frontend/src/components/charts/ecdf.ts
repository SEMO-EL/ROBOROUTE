/** Shared helpers for cumulative-distribution charts. */

export const SERIES_CLASSES = [
  { stroke: "stroke-series-1", fill: "bg-series-1" },
  { stroke: "stroke-series-2", fill: "bg-series-2" },
  { stroke: "stroke-series-3", fill: "bg-series-3" },
] as const;

export interface EcdfSeries {
  label: string;
  points: readonly (readonly number[])[];
}

/** F(x) of a step ECDF given as (x, F) points sorted by x. */
export function ecdfAt(points: readonly (readonly number[])[], value: number): number {
  let result = 0;
  for (const [px = 0, f = 0] of points) {
    if (px <= value) result = f;
    else break;
  }
  return result;
}
