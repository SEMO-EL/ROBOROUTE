import { useEffect, useState } from "react";
import { Link } from "react-router";

import { ErrorAlert } from "@/components/Alert";
import { api, type Scenario } from "@/lib/api/client";
import { fetchGrid, type GridResult, type RouteResult } from "@/lib/api/endpoints";
import { useProjectStore } from "@/stores/project";

import { ArenaCanvas } from "./ArenaCanvas";
import type { Selection } from "./ArenaLayers";
import { InspectPanel } from "./InspectPanel";
import { RoutePanel, type RouteDisplay } from "./RoutePanel";
import { CSpaceLayer, RouteLayer } from "./RouteLayers";

type ApiClient = typeof api;
type Route = RouteResult;
type Grid = GridResult;
type Tab = "inspect" | "route";

function useCSpaceGrid(scenario: Scenario | null, enabled: boolean, client: ApiClient) {
  const [state, setState] = useState<{ key: string; grid: Grid | null; error: string | null }>({
    key: "",
    grid: null,
    error: null,
  });
  const key = scenario ? JSON.stringify([scenario.arena, scenario.robot]) : "";

  useEffect(() => {
    if (!enabled || !scenario || state.key === key) return;
    let cancelled = false;
    fetchGrid(client, scenario)
      .then((grid) => {
        if (!cancelled) setState({ key, grid, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ key, grid: null, error: error instanceof Error ? error.message : "" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, scenario, key, state.key, client]);

  return state.key === key ? state : { key, grid: null, error: null };
}

export function ArenaPage({ client = api }: { client?: ApiClient }) {
  const scenario = useProjectStore((s) => s.scenario);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("inspect");
  const [route, setRoute] = useState<Route | null>(null);
  const [display, setDisplay] = useState<RouteDisplay>({ explored: true, cspace: false });
  const cspace = useCSpaceGrid(scenario, display.cspace, client);

  if (!scenario) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">No scenario loaded</h1>
        <p className="max-w-md text-muted">
          The arena view shows the field, obstacles and missions of a scenario. Load one from the
          overview to begin.
        </p>
        <Link
          to="/"
          className="rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent transition-colors hover:bg-accent-strong"
        >
          Choose a scenario
        </Link>
      </div>
    );
  }

  const select = (next: Selection) => {
    setSelection(next);
    if (next) setTab("inspect");
  };

  const layers = (
    <>
      {display.cspace && cspace.grid && <CSpaceLayer grid={cspace.grid} />}
      {tab === "route" && route?.status === "ok" && (
        <RouteLayer
          route={route}
          resolution={scenario.arena.grid_resolution}
          showExplored={display.explored}
        />
      )}
    </>
  );

  const tabClass = (value: Tab) =>
    [
      "flex-1 cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors",
      tab === value ? "border-accent text-text" : "border-transparent text-muted hover:text-text",
    ].join(" ");

  return (
    <div className="flex h-full min-h-0">
      <section aria-label={`Arena of ${scenario.name}`} className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <h1 className="font-semibold">Arena</h1>
          <span className="truncate text-muted">{scenario.name}</span>
        </header>
        <div className="min-h-0 flex-1">
          <ArenaCanvas
            scenario={scenario}
            selection={selection}
            onSelect={select}
            arenaLayers={layers}
          />
        </div>
      </section>
      <aside
        aria-label="Properties"
        className="flex w-80 shrink-0 flex-col border-l border-border bg-surface"
      >
        <div role="tablist" aria-label="Panel" className="flex border-b border-border">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "inspect"}
            className={tabClass("inspect")}
            onClick={() => {
              setTab("inspect");
            }}
          >
            Inspect
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "route"}
            className={tabClass("route")}
            onClick={() => {
              setTab("route");
            }}
          >
            Route
          </button>
        </div>
        <div role="tabpanel" className="flex-1 overflow-y-auto p-4">
          {tab === "inspect" ? (
            <InspectPanel scenario={scenario} selection={selection} />
          ) : (
            <div className="flex flex-col gap-4">
              <RoutePanel
                key={scenario.id}
                scenario={scenario}
                client={client}
                onResult={setRoute}
                display={display}
                onDisplayChange={setDisplay}
              />
              {cspace.error && <ErrorAlert>{cspace.error}</ErrorAlert>}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
