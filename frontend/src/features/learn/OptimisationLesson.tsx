import { ErrorAlert } from "@/components/Alert";
import { api, type Scenario } from "@/lib/api/client";
import type { OptimizeResult } from "@/lib/api/endpoints";
import { formatSeconds } from "@/lib/format/units";
import { scenarioKey, useStrategyStore } from "@/stores/strategy";

import { recurrenceRows, type RecurrenceRow } from "./dp";
import { Card, Formula, Missing, primaryButton } from "./ui";

type ApiClient = typeof api;

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const power = (n: number) => String(n).replace(/\d/g, (d) => SUPERSCRIPT[Number(d)] ?? d);
const s1 = (seconds: number) => seconds.toFixed(1);

export function OptimisationLesson({
  scenario,
  client,
}: {
  scenario: Scenario;
  client: ApiClient;
}) {
  const { result, status, error, run, scenarioKey: resultKey } = useStrategyStore();

  if (scenario.missions.length === 0) {
    return (
      <Missing to="/missions" action="Add missions">
        There are no missions to choose from yet. The optimiser decides which missions to attempt
        and in what order, so it needs at least one.
      </Missing>
    );
  }

  const fresh = result !== null && resultKey === scenarioKey(scenario) ? result : null;

  return (
    <div className="flex flex-col gap-4">
      <Card title="The question">
        <p>
          Which missions should the robot attempt, and in what order, to score the most expected
          points within {formatSeconds(scenario.format.time_budget)}? The expected score of a set of
          missions does not depend on their order, but the time to do them does. The optimiser
          therefore looks for, among all orders and sets that fit the budget, the set with the
          highest expected score.
        </p>
        {!fresh && (
          <>
            <p className="text-muted">
              {result
                ? "The scenario changed since the last optimisation. Run it again to see what the optimiser examined."
                : "Run the optimiser to see what it examined on this scenario."}
            </p>
            <button
              type="button"
              className={primaryButton}
              disabled={status === "running"}
              onClick={() => void run(scenario, client)}
            >
              {status === "running" ? "Optimising…" : "Optimise"}
            </button>
            {status === "error" && error && <ErrorAlert>{error.message}</ErrorAlert>}
          </>
        )}
      </Card>
      {fresh && <Explanation scenario={scenario} result={fresh} />}
    </div>
  );
}

function Explanation({ scenario, result }: { scenario: Scenario; result: OptimizeResult }) {
  const names: Record<string, string> = {
    start: "home",
    ...Object.fromEntries(scenario.missions.map((m) => [m.id, m.name])),
  };
  const summary = result.dp_summary;
  const optimal = result.optimal;

  if (!summary || !optimal) {
    return (
      <Card title="Too many missions for the exact method">
        <p>
          {result.candidates.length} candidate missions give 2{power(result.candidates.length)}{" "}
          subsets, more than the exact optimiser handles in reasonable time (it stops at 16
          missions). Only the greedy plan was computed, and it has no optimality guarantee.
        </p>
      </Card>
    );
  }

  const n = summary.missions;
  const rows = recurrenceRows(optimal.steps);
  const last = rows[rows.length - 1];
  const consistent = last ? Math.abs(last.total - optimal.completion_time) < 0.01 : true;

  return (
    <>
      <Card title="What the dynamic programme examined">
        <p>
          {n === 0
            ? "No mission can be attempted on its own within the budget, so the only choice is to do nothing."
            : `${String(n)} candidate missions${result.excluded.length > 0 ? ` (${String(result.excluded.length)} more were excluded because they can never fit)` : ""} give 2${power(n)} = ${summary.subsets.toLocaleString()} subsets.`}
        </p>
        <p>
          Instead of trying every order of every subset, the DP keeps one number per state (S, j,
          a): the least time C needed to finish exactly the missions in S, standing at mission j,
          with attachment a mounted.
        </p>
        <Formula>{`C(∅, home) = 0
C(S ∪ {k}, k) = min over j of  C(S, j) + τ(j → k) + d(k)       do mission k next
C(S, home)    = min over j of  C(S, j) + τ(j → home) + reset   start a new run (multi-run only)`}</Formula>
        <p className="text-muted">
          This is exact because what can still be done depends only on the state, not on how it was
          reached, and the expected score depends only on S. States that are already over the time
          budget are dropped.
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Table cells" value={summary.state_space.toLocaleString()} />
          <Stat label="Cells reached in time" value={summary.states_reached.toLocaleString()} />
          <Stat label="Subsets reached" value={summary.reachable_subsets.toLocaleString()} />
          <Stat label="Subsets that fit" value={summary.feasible_subsets.toLocaleString()} />
        </dl>
      </Card>

      <Card title="The best sets it found">
        <table className="w-full text-left text-xs">
          <caption className="mb-1 text-left text-muted">
            Best mission sets that fit the budget, by expected score (ties: shorter time)
          </caption>
          <thead className="text-faint">
            <tr>
              <th scope="col" className="py-1 font-normal">
                #
              </th>
              <th scope="col" className="font-normal">
                Missions
              </th>
              <th scope="col" className="text-right font-normal">
                Least time
              </th>
              <th scope="col" className="text-right font-normal">
                Expected score
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.best_sets.map((set, index) => (
              <tr key={set.missions.join("|")} className="border-t border-border">
                <td className="py-1 font-mono">{index + 1}</td>
                <td>
                  {set.missions.length > 0
                    ? set.missions.map((id) => names[id] ?? id).join(", ")
                    : "nothing"}
                  {index === 0 && <span className="ml-2 text-accent">chosen</span>}
                </td>
                <td className="text-right font-mono">{formatSeconds(set.completion_time)}</td>
                <td className="text-right font-mono">{set.expected_score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="The recurrence along the chosen plan">
        {rows.length === 0 ? (
          <p className="text-muted">The chosen plan attempts no mission.</p>
        ) : (
          <RecurrenceTable rows={rows} names={names} />
        )}
        <p className={consistent ? "text-muted" : "text-warning"}>
          {consistent
            ? `The last value equals the plan's completion time, ${formatSeconds(optimal.completion_time)}, within the budget of ${formatSeconds(scenario.format.time_budget)}.`
            : `The last value differs from the plan's completion time (${formatSeconds(optimal.completion_time)}); please report this.`}{" "}
          Travel times τ come from the route planner (or your measured times); d is each
          mission&apos;s average duration, with every allowed attempt budgeted.
        </p>
        <p className="text-muted">
          For comparison, the greedy rule (most expected points per second first) scores{" "}
          {result.greedy.expected_score.toFixed(1)} here, against the optimum&apos;s{" "}
          {optimal.expected_score.toFixed(1)}.
        </p>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-lg">{value}</dd>
    </div>
  );
}

function RecurrenceTable({
  rows,
  names,
}: {
  rows: RecurrenceRow[];
  names: Record<string, string>;
}) {
  const name = (id: string) => names[id] ?? id;
  const set = (ids: string[]) => `{${ids.map(name).join(", ")}}`;
  return (
    <table className="w-full text-left text-xs">
      <caption className="mb-1 text-left text-muted">
        The recurrence applied step by step (seconds)
      </caption>
      <thead className="text-faint">
        <tr>
          <th scope="col" className="py-1 font-normal">
            Step
          </th>
          <th scope="col" className="font-normal">
            New state
          </th>
          <th scope="col" className="font-normal">
            C = previous + travel + work
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-t border-border">
            <td className="py-1">
              {row.kind === "mission"
                ? `do ${name(row.at)}`
                : row.kind === "home"
                  ? "back home, reset"
                  : "finish at home"}
            </td>
            <td className="font-mono">
              C({set(row.done)}, {row.kind === "mission" ? name(row.at) : "home"})
            </td>
            <td className="font-mono">
              {s1(row.previous)} + {s1(row.travel)} + {s1(row.work)} = {s1(row.total)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
