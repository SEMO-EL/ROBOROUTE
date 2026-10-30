import type { GridResult, RouteResult } from "@/lib/api/endpoints";

import { cellsToPath, pointsAttribute, runsToPath } from "./routeGeometry";

type Route = RouteResult;
type Grid = GridResult;

/** Cells where the robot's centre may not go (obstacles inflated by its collision radius). */
export function CSpaceLayer({ grid }: { grid: Grid }) {
  return (
    <path
      d={runsToPath(grid.blocked_runs, grid.resolution)}
      className="fill-danger/15"
      data-testid="cspace-layer"
    />
  );
}

/** Cells A* or Dijkstra expanded while searching, plus the raw and smoothed routes. */
export function RouteLayer({
  route,
  resolution,
  showExplored,
}: {
  route: Route;
  resolution: number;
  showExplored: boolean;
}) {
  const expanded = (route.trace?.events ?? [])
    .filter((event) => event.kind === "expand")
    .map((event) => event.cell);
  return (
    <g data-testid="route-layer">
      {showExplored && expanded.length > 0 && (
        <path d={cellsToPath(expanded, resolution)} className="fill-accent/15" />
      )}
      {route.raw_points.length > 1 && (
        <polyline
          points={pointsAttribute(route.raw_points)}
          className="fill-none stroke-muted"
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {route.smoothed_points.length > 1 && (
        <polyline
          points={pointsAttribute(route.smoothed_points)}
          className="fill-none stroke-accent"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}
