/** Helpers that turn routing results into compact SVG geometry in arena units (metres). */

const fmt = (value: number) => Number(value.toFixed(6)).toString();

type Row = readonly number[];

/** Blocked-cell runs (row, first column, length) as a single path of rectangles. */
export function runsToPath(runs: readonly Row[], h: number): string {
  return runs
    .map(([row = 0, start = 0, length = 0]) => {
      const width = length * h;
      return `M${fmt(start * h)} ${fmt(row * h)}h${fmt(width)}v${fmt(h)}h${fmt(-width)}z`;
    })
    .join("");
}

/** Grid cells (column, row) as a single path of squares. */
export function cellsToPath(cells: readonly Row[], h: number): string {
  return cells
    .map(([i = 0, j = 0]) => `M${fmt(i * h)} ${fmt(j * h)}h${fmt(h)}v${fmt(h)}h${fmt(-h)}z`)
    .join("");
}

export function pointsAttribute(points: readonly Row[]): string {
  return points.map(([x = 0, y = 0]) => `${fmt(x)},${fmt(y)}`).join(" ");
}
