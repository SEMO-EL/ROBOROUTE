/**
 * Replaying a recorded A* / Dijkstra trace. The trace comes from the same code path that computed
 * the route (engine/pathfinding/trace.py), so the replay shows what actually happened.
 *
 * Event semantics: "expand" = the cell with the smallest f was taken from the frontier and its
 * distance is now final; "push" = a neighbour was reached by a shorter route than before and
 * (re-)entered the frontier with the given parent, g, h and f.
 */

export interface TraceEvent {
  kind: "expand" | "push";
  cell: readonly number[];
  parent: readonly number[] | null;
  g: number;
  h: number;
  f: number;
}

/** A push, annotated with whether it improved on an earlier route to the same cell. */
export interface PushedEvent extends TraceEvent {
  /** The cell was already in the frontier; this push found a shorter route to it. */
  improved: boolean;
  /** g of the earlier route when `improved`, otherwise null. */
  previousG: number | null;
}

export interface ReplayState {
  /** Number of expansions shown (0 = before the search starts). */
  step: number;
  totalSteps: number;
  current: TraceEvent | null;
  /** Cells the current expansion pushed (neighbours that got a better route). */
  pushed: PushedEvent[];
  closed: number[][];
  open: number[][];
  /** The last recorded expansion is shown (for a truncated trace this is not the search's end). */
  done: boolean;
}

const key = (cell: readonly number[]) => `${cell[0] ?? 0},${cell[1] ?? 0}`;

export function replay(events: readonly TraceEvent[], requestedStep: number): ReplayState {
  const totalSteps = events.filter((e) => e.kind === "expand").length;
  const step = Math.max(0, Math.min(requestedStep, totalSteps));
  const closed: number[][] = [];
  const closedKeys = new Set<string>();
  const open = new Map<string, number[]>();
  const bestG = new Map<string, number>();
  let current: TraceEvent | null = null;
  let pushed: PushedEvent[] = [];
  let expansions = 0;

  for (const event of events) {
    if (event.kind === "expand") {
      if (expansions === step) break;
      expansions += 1;
      current = event;
      pushed = [];
      const k = key(event.cell);
      closedKeys.add(k);
      open.delete(k);
      closed.push([...event.cell]);
    } else {
      if (expansions === 0) continue;
      const k = key(event.cell);
      const previousG = open.has(k) ? (bestG.get(k) ?? null) : null;
      pushed.push({ ...event, improved: previousG !== null, previousG });
      bestG.set(k, event.g);
      if (!closedKeys.has(k)) {
        open.delete(k); // re-pushing moves the cell to the back of the insertion order
        open.set(k, [...event.cell]);
      }
    }
  }
  // Before the first expansion the frontier holds only the start cell (it is never "pushed").
  const start = events.find((e) => e.kind === "expand");
  if (step === 0 && start) open.set(key(start.cell), [...start.cell]);
  return {
    step,
    totalSteps,
    current,
    pushed,
    closed,
    open: [...open.values()],
    done: step === totalSteps && totalSteps > 0,
  };
}

/** The path the search found, rebuilt from the latest parent of every pushed cell. */
export function pathFromTrace(
  events: readonly TraceEvent[],
  goal: readonly number[],
): number[][] | null {
  const parent = new Map<string, readonly number[] | null>();
  let reachedGoal = false;
  let start: readonly number[] | null = null;
  for (const event of events) {
    if (event.kind === "expand") {
      start ??= event.cell;
      if (key(event.cell) === key(goal)) reachedGoal = true;
    } else {
      parent.set(key(event.cell), event.parent);
    }
  }
  if (!reachedGoal || !start) return null;
  const path: number[][] = [[...goal]];
  let cursor: readonly number[] = goal;
  const guard = parent.size + 1;
  for (let i = 0; i < guard && key(cursor) !== key(start); i += 1) {
    const previous = parent.get(key(cursor));
    if (!previous) return null;
    path.push([...previous]);
    cursor = previous;
  }
  return path.reverse();
}
