/**
 * The DP recurrence (backend engine/optimization/dp.py) written out along one plan:
 *
 *   C(S ∪ {k}, k) = C(S, j) + τ(j, k) + d_k          (do mission k next)
 *   C(S, home)    = C(S, j) + τ(j, home) + reset     (multi-run: return home between runs)
 *
 * plus a final trip home when the robot must finish there. The plan's steps come from the API,
 * so the last total equals the plan's completion time.
 */

export interface PlanStep {
  kind: "travel" | "mission" | "reset";
  from_node: string;
  to_node: string;
  seconds: number;
}

export interface RecurrenceRow {
  kind: "mission" | "home" | "finish";
  /** Missions done after this row (the set S). */
  done: string[];
  from: string;
  at: string;
  previous: number;
  travel: number;
  /** Mission duration, reset time, or 0 for the final trip home. */
  work: number;
  total: number;
}

export function recurrenceRows(steps: readonly PlanStep[]): RecurrenceRow[] {
  const rows: RecurrenceRow[] = [];
  const done: string[] = [];
  let total = 0;
  let pending: PlanStep | null = null;
  const push = (kind: RecurrenceRow["kind"], at: string, work: number) => {
    const travel = pending?.seconds ?? 0;
    rows.push({
      kind,
      done: [...done],
      from: pending?.from_node ?? at,
      at,
      previous: total,
      travel,
      work,
      total: total + travel + work,
    });
    total += travel + work;
    pending = null;
  };
  for (const step of steps) {
    if (step.kind === "travel") {
      pending = step;
    } else if (step.kind === "mission") {
      done.push(step.to_node);
      push("mission", step.to_node, step.seconds);
    } else {
      push("home", "start", step.seconds);
    }
  }
  if (pending) push("finish", "start", 0);
  return rows;
}
