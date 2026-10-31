/**
 * Reading the search configuration from a route response and re-deriving h for display.
 * The formulas mirror backend engine/pathfinding/heuristics.py; the panel shows both the value the
 * backend recorded and this working, so a mismatch would be visible rather than hidden.
 */

export type HeuristicName = "octile" | "euclidean" | "manhattan" | "zero";

export interface SearchConfig {
  algorithm: "astar" | "dijkstra";
  heuristic: HeuristicName;
  connectivity: 4 | 8;
}

const HEURISTICS: readonly string[] = ["octile", "euclidean", "manhattan", "zero"];

/** Parses names like "astar[octile,8]" and "dijkstra[4]" (SearchStats.algorithm). */
export function parseAlgorithm(name: string): SearchConfig | null {
  const astar = /^astar\[(\w+),(\d)\]$/.exec(name);
  const dijkstra = /^dijkstra\[(\d)\]$/.exec(name);
  const connectivity = Number(astar?.[2] ?? dijkstra?.[1]);
  if (connectivity !== 4 && connectivity !== 8) return null;
  if (dijkstra) return { algorithm: "dijkstra", heuristic: "zero", connectivity };
  const heuristic = astar?.[1] ?? "";
  if (!HEURISTICS.includes(heuristic)) return null;
  return { algorithm: "astar", heuristic: heuristic as HeuristicName, connectivity };
}

export interface HeuristicWorking {
  dx: number;
  dy: number;
  value: number;
  formula: string;
}

/** Centimetres with up to two decimals, trailing zeros dropped ("0 cm", "24.14 cm"). */
export function formatCm(metres: number): string {
  return `${Number((metres * 100).toFixed(2)).toString()} cm`;
}

const cm = formatCm;

/** h(cell) towards `goal` on a grid with cells of size `h` metres, with the calculation. */
export function heuristicWorking(
  heuristic: HeuristicName,
  cell: readonly number[],
  goal: readonly number[],
  h: number,
): HeuristicWorking {
  const dx = Math.abs((cell[0] ?? 0) - (goal[0] ?? 0));
  const dy = Math.abs((cell[1] ?? 0) - (goal[1] ?? 0));
  const low = Math.min(dx, dy);
  const high = Math.max(dx, dy);
  switch (heuristic) {
    case "octile":
      return {
        dx,
        dy,
        value: h * (high - low + Math.SQRT2 * low),
        formula: `${cm(h)} × ((${String(high)} − ${String(low)}) + √2 × ${String(low)})`,
      };
    case "euclidean":
      return {
        dx,
        dy,
        value: h * Math.hypot(dx, dy),
        formula: `${cm(h)} × √(${String(dx)}² + ${String(dy)}²)`,
      };
    case "manhattan":
      return {
        dx,
        dy,
        value: h * (dx + dy),
        formula: `${cm(h)} × (${String(dx)} + ${String(dy)})`,
      };
    case "zero":
      return { dx, dy, value: 0, formula: "0 (Dijkstra)" };
  }
}
