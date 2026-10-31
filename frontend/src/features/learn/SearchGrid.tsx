import type { GridResult } from "@/lib/api/endpoints";

import type { ReplayState } from "./replay";

type Cell = readonly number[];

const fmt = (value: number) => Number(value.toFixed(6)).toString();

interface SearchGridProps {
  grid: GridResult;
  state: ReplayState;
  start: Cell | null;
  goal: Cell | null;
  /** Path rebuilt from the trace; only passed once the replay has really reached the goal. */
  path: readonly Cell[] | null;
}

/**
 * The planning grid as the search sees it: cells the robot's centre may not enter, cells whose
 * distance is final (closed), the frontier (open), the cell being expanded and the neighbours it
 * just updated. Drawn in metres with y pointing up, like the arena.
 */
export function SearchGrid({ grid, state, start, goal, path }: SearchGridProps) {
  const h = grid.resolution;
  const width = grid.columns * h;
  const height = grid.rows * h;
  const inset = h * 0.08;
  // Screen y grows downwards; row j occupies [height − (j + 1)·h, height − j·h].
  const top = (j: number) => height - (j + 1) * h;
  const square = ([i = 0, j = 0]: Cell, pad = inset) =>
    `M${fmt(i * h + pad)} ${fmt(top(j) + pad)}h${fmt(h - 2 * pad)}v${fmt(h - 2 * pad)}h${fmt(2 * pad - h)}z`;
  const cellsPath = (cells: readonly Cell[]) => cells.map((c) => square(c)).join("");
  const blocked = grid.blocked_runs
    .map(([row = 0, first = 0, length = 0]) => {
      const w = length * h;
      return `M${fmt(first * h)} ${fmt(top(row))}h${fmt(w)}v${fmt(h)}h${fmt(-w)}z`;
    })
    .join("");
  const centre = ([i = 0, j = 0]: Cell): [number, number] => [(i + 0.5) * h, top(j) + h / 2];
  // Markers stay legible on fine grids: at least 1/60 of the field's larger side.
  const markerRadius = Math.max(h * 0.42, Math.max(width, height) / 60);
  const marker = (cell: Cell, label: string, className: string) => {
    const [x, y] = centre(cell);
    return (
      <g>
        <circle
          cx={x}
          cy={y}
          r={markerRadius}
          className={`${className} stroke-bg`}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={markerRadius * 1.3}
          className="fill-bg font-semibold"
        >
          {label}
        </text>
      </g>
    );
  };
  const current = state.current?.cell ?? null;
  const summary =
    `Search grid, ${String(grid.columns)} by ${String(grid.rows)} cells: ` +
    `${String(state.closed.length)} final, ${String(state.open.length)} in the frontier` +
    (current ? `, expanding (${String(current[0])}, ${String(current[1])})` : "");

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${fmt(width)} ${fmt(height)}`}
        className="h-auto max-h-[60vh] w-full rounded-md border border-border bg-field"
        role="img"
        aria-label={summary}
      >
        <path d={blocked} className="fill-obstacle" />
        <path d={cellsPath(state.closed)} className="fill-series-1/45" />
        <path d={cellsPath(state.open)} className="fill-series-2/80" />
        {state.pushed.length > 0 && (
          <path
            d={state.pushed.map((e) => square(e.cell, inset / 2)).join("")}
            className="fill-none stroke-text"
            strokeWidth={1.5}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {current && (
          <path
            d={square(current, 0)}
            className="fill-accent stroke-text"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {path && path.length > 1 && (
          <polyline
            data-testid="replayed-path"
            points={path.map((c) => centre(c).map(fmt).join(",")).join(" ")}
            className="fill-none stroke-text"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {start && marker(start, "S", "fill-start")}
        {goal && marker(goal, "G", "fill-mission")}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <Swatch className="bg-obstacle">Robot centre cannot go here</Swatch>
        <Swatch className="bg-series-1/45">Final (closed)</Swatch>
        <Swatch className="bg-series-2/80">Frontier (open)</Swatch>
        <Swatch className="bg-accent">Being expanded</Swatch>
        <Swatch className="border border-dashed border-text">Just updated</Swatch>
      </figcaption>
    </figure>
  );
}

function Swatch({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block size-3 rounded-sm ${className}`} />
      {children}
    </span>
  );
}
