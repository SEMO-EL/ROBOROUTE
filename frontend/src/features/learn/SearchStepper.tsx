import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import type { GridResult, RouteResult } from "@/lib/api/endpoints";

import { pathFromTrace, replay, type PushedEvent, type TraceEvent } from "./replay";
import { SearchGrid } from "./SearchGrid";
import { formatCm, heuristicWorking, parseAlgorithm, type SearchConfig } from "./search";

const TICK_MS = 120;
const SPEEDS = [1, 5, 25, 100] as const;

const cellLabel = (cell: readonly number[]) => `(${String(cell[0])}, ${String(cell[1])})`;
const sameCells = (a: readonly (readonly number[])[], b: readonly (readonly number[])[]) =>
  a.length === b.length && a.every((cell, i) => cell[0] === b[i]?.[0] && cell[1] === b[i]?.[1]);

interface SearchStepperProps {
  route: RouteResult;
  grid: GridResult;
}

/** Step-by-step replay of the search that produced `route`, from its recorded trace. */
export function SearchStepper({ route, grid }: SearchStepperProps) {
  const events = useMemo(() => route.trace?.events ?? [], [route.trace]);
  const truncated = route.trace?.truncated ?? false;
  const config = route.search ? parseAlgorithm(route.search.algorithm) : null;
  const total = useMemo(() => events.filter((e) => e.kind === "expand").length, [events]);
  // About 15 s for a full playback at the default speed.
  const defaultSpeed = SPEEDS.find((s) => s * (15_000 / TICK_MS) >= total) ?? 100;

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(defaultSpeed);
  const isPlaying = playing && step < total;

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setStep((s) => Math.min(total, s + speed));
    }, TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, [isPlaying, speed, total]);

  const state = useMemo(() => replay(events, step), [events, step]);
  const finished = state.done && !truncated;
  const goal = route.goal_cell ?? null;
  const path = useMemo(
    () => (finished && goal ? pathFromTrace(events, goal) : null),
    [finished, goal, events],
  );

  const go = (next: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(total, next)));
  };
  const sliderId = useId();
  const speedId = useId();

  return (
    <div className="flex flex-col gap-4">
      {truncated && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          The recording stopped after {events.length.toLocaleString()} events (the trace limit),{" "}
          {total.toLocaleString()} expansions in. The search itself carried on; this replay ends
          there, so the final path is not shown.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <div className="flex flex-col gap-3">
          <SearchGrid
            grid={grid}
            state={state}
            start={route.start_cell ?? null}
            goal={goal}
            path={path}
          />
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Playback">
            <IconButton
              label="First step"
              onClick={() => {
                go(0);
              }}
              disabled={step === 0}
            >
              <ChevronFirst className="size-4" />
            </IconButton>
            <IconButton
              label="Previous step"
              onClick={() => {
                go(step - 1);
              }}
              disabled={step === 0}
            >
              <ChevronLeft className="size-4" />
            </IconButton>
            <IconButton
              label={isPlaying ? "Pause" : "Play"}
              onClick={() => {
                if (isPlaying) {
                  setPlaying(false);
                } else {
                  if (step >= total) setStep(0);
                  setPlaying(true);
                }
              }}
              disabled={total === 0}
            >
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            </IconButton>
            <IconButton
              label="Next step"
              onClick={() => {
                go(step + 1);
              }}
              disabled={step >= total}
            >
              <ChevronRight className="size-4" />
            </IconButton>
            <IconButton
              label="Last step"
              onClick={() => {
                go(total);
              }}
              disabled={step >= total}
            >
              <ChevronLast className="size-4" />
            </IconButton>
            <label htmlFor={sliderId} className="sr-only">
              Step
            </label>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={total}
              value={step}
              onChange={(e) => {
                go(Number(e.target.value));
              }}
              className="min-w-32 flex-1 accent-accent"
            />
            <label htmlFor={speedId} className="text-xs text-muted">
              Speed
            </label>
            <select
              id={speedId}
              value={speed}
              onChange={(e) => {
                setSpeed(Number(e.target.value));
              }}
              className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-text"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s === 1 ? "1 step" : `${String(s)} steps`} per tick
                </option>
              ))}
            </select>
          </div>
        </div>

        <StepDetails
          route={route}
          grid={grid}
          config={config}
          step={step}
          total={total}
          current={state.current}
          pushed={state.pushed}
          closed={state.closed.length}
          frontier={state.open.length}
          finished={finished}
          path={path}
        />
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer rounded-md border border-border bg-surface-2 p-1.5 text-text hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

interface StepDetailsProps {
  route: RouteResult;
  grid: GridResult;
  config: SearchConfig | null;
  step: number;
  total: number;
  current: TraceEvent | null;
  pushed: PushedEvent[];
  closed: number;
  frontier: number;
  finished: boolean;
  path: number[][] | null;
}

function StepDetails({
  route,
  grid,
  config,
  step,
  total,
  current,
  pushed,
  closed,
  frontier,
  finished,
  path,
}: StepDetailsProps) {
  const goal = route.goal_cell ?? null;
  const dijkstra = config?.algorithm === "dijkstra";
  const working =
    current && goal && config
      ? heuristicWorking(config.heuristic, current.cell, goal, grid.resolution)
      : null;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">
          Step {step.toLocaleString()} of {total.toLocaleString()}
        </h3>
        <p className="text-xs text-muted">
          Final: <span className="font-mono text-text">{closed.toLocaleString()}</span> · Frontier:{" "}
          <span className="font-mono text-text" data-testid="frontier-count">
            {frontier.toLocaleString()}
          </span>
        </p>
      </div>

      {step === 0 || !current ? (
        <p className="text-muted">
          Before the search starts, the frontier holds only the start cell S, with g = 0
          {dijkstra ? "." : " and f = h(S)."} Each step takes the frontier cell with the smallest{" "}
          {dijkstra ? "g" : "f = g + h"} and makes its distance final.
        </p>
      ) : (
        <section
          aria-label="Expanded cell"
          className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3"
        >
          <p>
            Expanding <span className="font-mono">{cellLabel(current.cell)}</span>
          </p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">g (distance from start)</dt>
            <dd className="font-mono" data-testid="value-g">
              {formatCm(current.g)}
            </dd>
            <dt className="text-muted">h (estimate to goal)</dt>
            <dd className="font-mono" data-testid="value-h">
              {formatCm(current.h)}
            </dd>
            {working && config?.heuristic !== "zero" && (
              <>
                <dt className="text-xs text-faint">
                  {config?.heuristic} (Δx = {working.dx}, Δy = {working.dy})
                </dt>
                <dd className="font-mono text-xs text-faint">{working.formula}</dd>
              </>
            )}
            <dt className="text-muted">f = g + h</dt>
            <dd className="font-mono" data-testid="value-f">
              {formatCm(current.f)}
            </dd>
          </dl>
          {working && Math.abs(working.value - current.h) > 1e-9 && (
            <p className="text-xs text-warning">
              Recomputed h ({formatCm(working.value)}) differs from the recorded value.
            </p>
          )}
          <p className="text-xs text-muted">
            {dijkstra
              ? "It had the smallest g in the frontier, so no shorter route to it can exist: its distance is now final."
              : "It had the smallest f in the frontier (ties: smaller h, then the cell pushed earliest). With an admissible, consistent heuristic its g is now final."}
          </p>
        </section>
      )}

      {current && step > 0 && <PushedTable pushed={pushed} />}

      {finished && route.status === "ok" && path && (
        <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-success">
          Goal reached after {total.toLocaleString()} expansions. Following each cell&apos;s parent
          back from G gives {path.length.toLocaleString()} cells with cost{" "}
          {formatCm(current?.g ?? 0)}
          {sameCells(path, route.grid_path)
            ? ", and it matches the route's grid path."
            : ". It does not match the route's grid path; please report this."}
        </p>
      )}
      {finished && route.status === "unreachable" && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
          The frontier became empty without reaching the goal: every cell reachable from the start
          was expanded, so no route exists at this grid resolution.
        </p>
      )}
    </div>
  );
}

function PushedTable({ pushed }: { pushed: PushedEvent[] }) {
  if (pushed.length === 0) {
    return (
      <p className="text-xs text-muted">
        No neighbour was updated: each one was blocked, already final, or already reached by a route
        at least as short.
      </p>
    );
  }
  return (
    <table className="w-full text-left text-xs">
      <caption className="mb-1 text-left text-muted">
        Neighbours updated by this expansion (they enter or move within the frontier)
      </caption>
      <thead className="text-faint">
        <tr>
          <th scope="col" className="py-1 font-normal">
            Cell
          </th>
          <th scope="col" className="font-normal">
            g
          </th>
          <th scope="col" className="font-normal">
            h
          </th>
          <th scope="col" className="font-normal">
            f
          </th>
          <th scope="col" className="font-normal">
            Note
          </th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {pushed.map((event, index) => (
          <tr key={index} className="border-t border-border">
            <td className="py-1">{cellLabel(event.cell)}</td>
            <td>{formatCm(event.g)}</td>
            <td>{formatCm(event.h)}</td>
            <td>{formatCm(event.f)}</td>
            <td className="font-sans text-muted">
              {event.improved && event.previousG !== null
                ? `shorter route (was ${formatCm(event.previousG)})`
                : "new"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
