import { useState } from "react";

import { ErrorAlert } from "@/components/Alert";
import { RoutePanel } from "@/features/arena/RoutePanel";
import { api, type Scenario } from "@/lib/api/client";
import { fetchGrid, type GridResult, type RouteResult } from "@/lib/api/endpoints";

import { SearchStepper } from "./SearchStepper";
import { Card, Formula, Missing } from "./ui";

type ApiClient = typeof api;

export function PathfindingLesson({ scenario, client }: { scenario: Scenario; client: ApiClient }) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [grid, setGrid] = useState<GridResult | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
  // A new search restarts the replay at step 0.
  const [run, setRun] = useState(0);

  if (scenario.missions.length === 0) {
    return (
      <Missing to="/arena" action="Add a mission in the arena">
        This scenario has no missions yet, so there is nowhere to plan a route to. Routes run from
        the start pose to each mission&apos;s approach pose.
      </Missing>
    );
  }

  async function onResult(result: RouteResult | null) {
    setRoute(result);
    setRun((n) => n + 1);
    if (!result) return;
    try {
      setGridError(null);
      setGrid(await fetchGrid(client, scenario));
    } catch (cause) {
      setGrid(null);
      setGridError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const traced = route?.trace && route.trace.events.length > 0 ? route : null;

  return (
    <div className="flex flex-col gap-4">
      <Card title="How the route is found">
        <p>
          The field is divided into square cells of{" "}
          {(scenario.arena.grid_resolution * 100).toFixed(1)} cm. A cell counts as free only if a
          disc enclosing the robot in any orientation (plus the safety margin) can sit anywhere in
          that cell without touching an obstacle or wall, so the search can treat the robot as a
          point. From the start cell, A* repeatedly takes the frontier cell with the smallest
        </p>
        <Formula>{`f(n) = g(n) + h(n)
g(n) = length of the best route found so far from the start to n
h(n) = an estimate of the remaining length to the goal (never too long, so the result is a shortest grid path)`}</Formula>
        <p className="text-muted">
          Dijkstra&apos;s algorithm is the same with h = 0: it explores evenly in every direction.
          Plan a route below, then step through exactly what the search did.
        </p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          <RoutePanel scenario={scenario} client={client} onResult={(r) => void onResult(r)} />
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
          {gridError && <ErrorAlert>{gridError}</ErrorAlert>}
          {traced && grid ? (
            <SearchStepper key={run} route={traced} grid={grid} />
          ) : (
            <p className="text-sm text-muted">
              {route && !traced
                ? "This request stopped before any search ran, so there is nothing to replay."
                : "The step-through appears here after you plan a route."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
