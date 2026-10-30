import { useId, useState } from "react";

import { ErrorAlert } from "@/components/Alert";
import { api, type Scenario } from "@/lib/api/client";
import { planRoute, type RouteResult } from "@/lib/api/endpoints";
import { formatLength, formatSeconds } from "@/lib/format/units";

type ApiClient = typeof api;
type Route = RouteResult;
type Algorithm = "astar" | "dijkstra";
type HeuristicName = "octile" | "euclidean" | "manhattan" | "zero";

const HEURISTICS: { value: HeuristicName; label: string }[] = [
  { value: "octile", label: "Octile" },
  { value: "euclidean", label: "Euclidean" },
  { value: "manhattan", label: "Manhattan" },
  { value: "zero", label: "Zero (= Dijkstra)" },
];

export interface RouteDisplay {
  explored: boolean;
  cspace: boolean;
}

interface RoutePanelProps {
  scenario: Scenario;
  client?: ApiClient;
  onResult: (route: Route | null) => void;
  display?: RouteDisplay;
  onDisplayChange?: (display: RouteDisplay) => void;
}

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const selectClass =
  "rounded-md border border-border bg-surface-2 px-2 py-1.5 text-text disabled:opacity-50";

export function RoutePanel({
  scenario,
  client = api,
  onResult,
  display,
  onDisplayChange,
}: RoutePanelProps) {
  const nodes = [
    { id: "start", label: "Start pose" },
    ...scenario.missions.map((m) => ({ id: m.id, label: m.name })),
  ];
  const [from, setFrom] = useState("start");
  const [to, setTo] = useState(scenario.missions[0]?.id ?? "start");
  const [algorithm, setAlgorithm] = useState<Algorithm>("astar");
  const [heuristic, setHeuristic] = useState<HeuristicName>("octile");
  const [connectivity, setConnectivity] = useState<4 | 8>(8);
  const [pending, setPending] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [error, setError] = useState<string | null>(null);

  const admissible = !(heuristic === "manhattan" && connectivity === 8) || algorithm === "dijkstra";

  async function plan() {
    setPending(true);
    setError(null);
    try {
      const result = await planRoute(client, {
        scenario,
        from_node: from,
        to_node: to,
        options: { algorithm, heuristic, connectivity, smooth: true },
        include_trace: true,
        trace_limit: 100_000,
      });
      setRoute(result);
      onResult(result);
    } catch (cause) {
      setRoute(null);
      onResult(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  }

  const radio = (value: Algorithm, label: string) => (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input
        type="radio"
        name="algorithm"
        value={value}
        checked={algorithm === value}
        onChange={() => {
          setAlgorithm(value);
        }}
        className="accent-accent"
      />
      {label}
    </label>
  );

  return (
    <section className="flex flex-col gap-4" aria-label="Route planning">
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
              }}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="To">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
              }}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-muted">Algorithm</legend>
        <div className="flex gap-4">
          {radio("astar", "A*")}
          {radio("dijkstra", "Dijkstra")}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Heuristic">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={heuristic}
              disabled={algorithm === "dijkstra"}
              onChange={(e) => {
                setHeuristic(e.target.value as HeuristicName);
              }}
            >
              {HEURISTICS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Moves">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={connectivity}
              onChange={(e) => {
                setConnectivity(Number(e.target.value) as 4 | 8);
              }}
            >
              <option value={8}>8 directions</option>
              <option value={4}>4 directions</option>
            </select>
          )}
        </Field>
      </div>
      {!admissible && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-warning">
          Manhattan distance is not admissible with diagonal moves: it can overestimate the
          remaining cost, so A* may return a longer path than necessary.
        </p>
      )}

      {display && onDisplayChange && (
        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="accent-accent"
              checked={display.explored}
              onChange={(e) => {
                onDisplayChange({ ...display, explored: e.target.checked });
              }}
            />
            Show expanded cells
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="accent-accent"
              checked={display.cspace}
              onChange={(e) => {
                onDisplayChange({ ...display, cspace: e.target.checked });
              }}
            />
            Show where the robot centre cannot go
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={() => void plan()}
        disabled={pending || from === to}
        className="cursor-pointer rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Planning…" : "Plan route"}
      </button>

      {error && <ErrorAlert>{error}</ErrorAlert>}
      {route && route.status !== "ok" && <ErrorAlert>{route.message}</ErrorAlert>}
      {route?.status === "ok" && <RouteSummary route={route} />}
    </section>
  );
}

function RouteSummary({ route }: { route: Route }) {
  const rows: [string, string][] = [];
  if (route.length_smoothed !== null)
    rows.push(["Route length", formatLength(route.length_smoothed)]);
  if (route.length_raw !== null) rows.push(["Grid path length", formatLength(route.length_raw)]);
  if (route.timing) {
    rows.push(["Modelled time", formatSeconds(route.timing.total)]);
    rows.push(["  driving", formatSeconds(route.timing.translation)]);
    rows.push(["  turning", formatSeconds(route.timing.rotation)]);
  }
  if (route.search) rows.push(["Cells expanded", route.search.expanded.toString()]);

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="whitespace-pre text-muted">{label}</dt>
            <dd className="font-mono text-xs leading-5">{value}</dd>
          </div>
        ))}
      </dl>
      {route.search && (
        <p className="text-xs text-muted">
          {route.search.optimality_guaranteed
            ? "Shortest grid path guaranteed (admissible heuristic). Smoothing then shortens it further."
            : "No optimality guarantee for this heuristic."}{" "}
          Times are modelled from the robot's speed settings, not measured.
        </p>
      )}
    </div>
  );
}
