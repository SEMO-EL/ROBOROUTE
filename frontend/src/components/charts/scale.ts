/** Minimal scale helpers for hand-written SVG charts (data are binned by the engine). */

export function linearScale(domain: readonly [number, number], range: readonly [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 === d0) return () => (r0 + r1) / 2;
  const k = (r1 - r0) / (d1 - d0);
  return (value: number) => r0 + (value - d0) * k;
}

/**
 * Round tick values (1, 2 or 5 × 10ⁿ steps) covering [min, max] with about `count` ticks.
 * The step multiplier is the nice value nearest (geometrically) to the raw step, as in D3.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const error = raw / magnitude;
  const factor =
    error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.SQRT2 ? 2 : 1;
  const step = factor * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 0.999; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}
