const NICE_LENGTHS_M = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];

/** The largest "nice" length whose on-screen size does not exceed `maxPixels`. */
export function niceScaleLength(zoom: number, maxPixels = 140): number {
  let best = NICE_LENGTHS_M[0] ?? 0.01;
  for (const length of NICE_LENGTHS_M) {
    if (length * zoom <= maxPixels) best = length;
  }
  return best;
}
