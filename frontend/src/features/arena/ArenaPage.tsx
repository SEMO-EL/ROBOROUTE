import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { ErrorAlert } from "@/components/Alert";
import { api, type Scenario } from "@/lib/api/client";
import { fetchGrid, type GridResult, type RouteResult } from "@/lib/api/endpoints";
import type { Vec2 } from "@/lib/geometry/viewport";
import { useProjectStore } from "@/stores/project";

import { ArenaCanvas, type ArenaEditing, type Tool } from "./ArenaCanvas";
import {
  addMission,
  addObstacle,
  deleteSelection,
  moveSelection,
  positionOf,
  setHeading,
  snap as snapTo,
} from "./editing";
import { EditorToolbar } from "./EditorToolbar";
import { InspectPanel } from "./InspectPanel";
import { RoutePanel, type RouteDisplay } from "./RoutePanel";
import { CSpaceLayer, RouteLayer } from "./RouteLayers";
import type { Selection } from "./selection";
import { TOOL_SHORTCUTS } from "./tools";
import { useValidation, type ValidationState } from "./useValidation";

type ApiClient = typeof api;
type Tab = "inspect" | "route";

const SNAP_STEP = 0.01; // 1 cm
const HEADING_SNAP = Math.PI / 36; // 5°

function useCSpaceGrid(scenario: Scenario | null, enabled: boolean, client: ApiClient) {
  const [state, setState] = useState<{
    key: string;
    grid: GridResult | null;
    error: string | null;
  }>({
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
        if (!cancelled)
          setState({ key, grid: null, error: error instanceof Error ? error.message : "" });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, scenario, key, state.key, client]);
  return state.key === key ? state : { key, grid: null, error: null };
}

function ValidationBadge({ state }: { state: ValidationState }) {
  if (state.kind === "checking") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> Checking…
      </span>
    );
  }
  if (state.kind === "unavailable") {
    return (
      <span className="text-xs text-muted" title={state.message}>
        Validation unavailable
      </span>
    );
  }
  const errors = state.issues.filter((i) => i.severity === "error").length;
  const warnings = state.issues.length - errors;
  if (state.issues.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <CircleCheck aria-hidden="true" className="size-3.5" /> Valid scenario
      </span>
    );
  }
  return (
    <span
      className={`flex items-center gap-1.5 text-xs ${errors ? "text-danger" : "text-warning"}`}
    >
      <CircleAlert aria-hidden="true" className="size-3.5" />
      {errors > 0 && `${errors} error${errors > 1 ? "s" : ""}`}
      {errors > 0 && warnings > 0 && ", "}
      {warnings > 0 && `${warnings} warning${warnings > 1 ? "s" : ""}`}
    </span>
  );
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function ArenaPage({ client = api }: { client?: ApiClient }) {
  const scenario = useProjectStore((s) => s.scenario);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const { edit, preview, commit, undo, redo } = useProjectStore.getState();
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("inspect");
  const [tool, setTool] = useState<Tool>("select");
  const [snap, setSnap] = useState(true);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [display, setDisplay] = useState<RouteDisplay>({ explored: true, cspace: false });
  const gestureStart = useRef<Scenario | null>(null);
  const cspace = useCSpaceGrid(scenario, display.cspace, client);
  const validation = useValidation(scenario, client);

  // Keyboard shortcuts for editing, active anywhere on the page except in form fields.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      const state = useProjectStore.getState();
      const current = state.scenario;
      if (!current) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        state.redo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selection &&
        selection.kind !== "start"
      ) {
        event.preventDefault();
        state.edit(deleteSelection(current, selection));
        setSelection(null);
        return;
      }
      const nudge: Record<string, Vec2> = {
        ArrowLeft: { x: -SNAP_STEP, y: 0 },
        ArrowRight: { x: SNAP_STEP, y: 0 },
        ArrowUp: { x: 0, y: SNAP_STEP },
        ArrowDown: { x: 0, y: -SNAP_STEP },
      };
      const delta = nudge[event.key];
      if (delta && selection) {
        const position = positionOf(current, selection);
        if (position) {
          event.preventDefault();
          state.edit(
            moveSelection(current, selection, { x: position.x + delta.x, y: position.y + delta.y }),
          );
        }
        return;
      }
      const shortcut = TOOL_SHORTCUTS[key];
      if (shortcut && event.key.length === 1) setTool(shortcut);
      if (event.key === "Escape") setTool("select");
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [selection]);

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

  const step = snap ? SNAP_STEP : 0;
  const snapped = (p: Vec2) => ({ x: snapTo(p.x, step), y: snapTo(p.y, step) });

  const editing: ArenaEditing = {
    tool,
    onPlace: (point) => {
      const current = useProjectStore.getState().scenario;
      if (!current) return;
      const at = snapped(point);
      const result =
        tool === "mission"
          ? addMission(current, at)
          : addObstacle(
              current,
              tool === "nogo" ? "no_go" : "solid",
              tool === "circle" ? "circle" : "rect",
              at,
            );
      edit(result.scenario);
      setSelection(
        tool === "mission"
          ? { kind: "mission", id: result.id }
          : { kind: "obstacle", id: result.id },
      );
      setTab("inspect");
      setTool("select");
    },
    onDrag: (target, position, phase) => {
      const current = useProjectStore.getState().scenario;
      if (!current) return;
      if (phase === "start") gestureStart.current = current;
      preview(moveSelection(current, target, snapped(position)));
      if (phase === "end" && gestureStart.current) {
        commit(gestureStart.current);
        gestureStart.current = null;
      }
    },
    onHeading: (target, theta, phase) => {
      const current = useProjectStore.getState().scenario;
      if (!current) return;
      if (phase === "start") gestureStart.current = current;
      const heading = snap ? Math.round(theta / HEADING_SNAP) * HEADING_SNAP : theta;
      preview(setHeading(current, target, heading));
      if (phase === "end" && gestureStart.current) {
        commit(gestureStart.current);
        gestureStart.current = null;
      }
    },
  };

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
          <span className="hidden truncate text-muted lg:inline">{scenario.name}</span>
          <ValidationBadge state={validation} />
          <div className="ml-auto">
            <EditorToolbar
              tool={tool}
              onTool={setTool}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              snap={snap}
              onSnap={setSnap}
            />
          </div>
        </header>
        <div className="min-h-0 flex-1">
          <ArenaCanvas
            scenario={scenario}
            selection={selection}
            onSelect={select}
            arenaLayers={layers}
            editing={editing}
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
            <InspectPanel scenario={scenario} selection={selection} validation={validation} />
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
