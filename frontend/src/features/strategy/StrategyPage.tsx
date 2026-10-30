import { Check, Minus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { ErrorAlert } from "@/components/Alert";
import { ArenaCanvas } from "@/features/arena/ArenaCanvas";
import { pointsAttribute } from "@/features/arena/routeGeometry";
import { api, type Scenario } from "@/lib/api/client";
import type { OptimizeResult } from "@/lib/api/endpoints";
import { formatSeconds } from "@/lib/format/units";
import { useProjectStore } from "@/stores/project";
import { scenarioKey, useStrategyStore } from "@/stores/strategy";

import { Timeline } from "./Timeline";

type ApiClient = typeof api;
type PlanOut = NonNullable<OptimizeResult["optimal"]>;

const points = (value: number) => value.toFixed(1);

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5" title={hint}>
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-xl">
        {value}
        {unit && <span className="ml-1 text-sm text-muted">{unit}</span>}
      </span>
    </div>
  );
}

function Runs({ plan, names }: { plan: PlanOut; names: Record<string, string> }) {
  if (plan.runs.length === 0)
    return <p className="text-muted">No mission fits in the time budget.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {plan.runs.map((run, index) => (
        <li key={run.join("|")} className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 shrink-0 text-xs text-muted">Run {index + 1}</span>
          {run.map((id, position) => (
            <span key={id} className="flex items-center gap-1.5">
              {position > 0 && <span className="text-faint">→</span>}
              <span className="rounded border border-border bg-surface-2 px-2 py-0.5">
                {names[id] ?? id}
              </span>
            </span>
          ))}
        </li>
      ))}
    </ol>
  );
}

function PlanMap({ scenario, plan }: { scenario: Scenario; plan: PlanOut }) {
  const layers = (
    <g>
      {plan.route.map((leg, index) =>
        leg.length > 1 ? (
          <polyline
            key={`${index}-${leg.length}`}
            points={pointsAttribute(leg)}
            className="fill-none stroke-accent"
            strokeWidth={2.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null,
      )}
    </g>
  );
  return (
    <div className="h-80 overflow-hidden rounded border border-border">
      <ArenaCanvas
        scenario={scenario}
        selection={null}
        onSelect={() => undefined}
        arenaLayers={layers}
      />
    </div>
  );
}

function Results({ scenario, result }: { scenario: Scenario; result: OptimizeResult }) {
  const names: Record<string, string> = {
    start: "Start",
    ...Object.fromEntries(scenario.missions.map((m) => [m.id, m.name])),
  };
  const optimal = result.optimal;
  const greedy = result.greedy;
  const budget = scenario.format.time_budget;
  const [shown, setShown] = useState<"optimal" | "greedy">("optimal");
  const plan = shown === "optimal" && optimal ? optimal : greedy;

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Recommended plan"
        aside={
          <span className="text-xs text-muted">
            computed in {result.compute_seconds.toFixed(2)} s
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {optimal && (
            <Stat
              label="Expected score (optimal)"
              value={points(optimal.expected_score)}
              unit="pts"
              hint="Expected value under the planning model — not a measured or simulated score."
            />
          )}
          <Stat label="Greedy baseline" value={points(greedy.expected_score)} unit="pts" />
          <Stat
            label="Planned time"
            value={plan.completion_time.toFixed(1)}
            unit={`/ ${budget} s`}
          />
          <Stat
            label="Missions"
            value={plan.runs.flat().length.toString()}
            unit={`of ${result.candidates.length}`}
          />
        </div>
        {optimal && (
          <p className="mt-3 text-sm text-muted">
            {optimal.expected_score - greedy.expected_score > 1e-9
              ? `Exact optimisation gains +${points(optimal.expected_score - greedy.expected_score)} expected points over the greedy rule (best points per second first).`
              : "The greedy rule happens to find an equally good selection here."}
          </p>
        )}
        <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Plan shown">
          {(["optimal", "greedy"] as const).map((value) =>
            value === "optimal" && !optimal ? null : (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={shown === value}
                onClick={() => {
                  setShown(value);
                }}
                className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-sm aria-checked:border-accent aria-checked:text-accent"
              >
                {value === "optimal" ? "Optimal plan" : "Greedy plan"}
              </button>
            ),
          )}
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <Runs plan={plan} names={names} />
          <Timeline steps={plan.steps} budget={budget} names={names} />
          <PlanMap scenario={scenario} plan={plan} />
        </div>
      </Section>

      {result.explanation && (
        <Section title="Why this plan">
          <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            {[
              ["Travel", result.explanation.travel_seconds],
              ["Mission work", result.explanation.mission_seconds],
              ["Resets in home", result.explanation.reset_seconds],
              ["Slack", result.explanation.slack],
            ].map(([label, seconds]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-mono">
                  {formatSeconds(Number((seconds as number).toFixed(1)))}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="flex flex-col divide-y divide-border">
            {result.explanation.verdicts.map((verdict) => (
              <li key={verdict.mission} className="flex items-start gap-3 py-2">
                {verdict.selected ? (
                  <Check aria-label="chosen" className="mt-0.5 size-4 shrink-0 text-accent" />
                ) : (
                  <Minus aria-label="left out" className="mt-0.5 size-4 shrink-0 text-muted" />
                )}
                <div>
                  <div className="font-medium">{names[verdict.mission] ?? verdict.mission}</div>
                  <div className="text-muted">{verdict.reason}</div>
                </div>
              </li>
            ))}
          </ul>
          {result.excluded.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
                Not plannable
              </h3>
              <ul className="flex flex-col gap-1">
                {result.excluded.map((item) => (
                  <li key={item.mission}>
                    <span className="font-medium">{names[item.mission] ?? item.mission}:</span>{" "}
                    <span className="text-muted">{item.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {result.sensitivity.length > 0 && (
        <Section title="If the robot were faster or slower">
          <table className="w-full text-left">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 font-medium">Top speed</th>
                <th className="py-1 font-medium">Best expected score</th>
                <th className="py-1 font-medium">Plan</th>
              </tr>
            </thead>
            <tbody>
              {result.sensitivity.map((row) => (
                <tr key={row.factor} className="border-t border-border">
                  <td className="py-1.5 font-mono">×{row.factor}</td>
                  <td className="py-1.5 font-mono">{points(row.best_score)}</td>
                  <td className="py-1.5 text-muted">
                    {row.same_selection_as_baseline
                      ? "same missions"
                      : `different missions: ${row.runs.map((run) => run.map((id) => names[id] ?? id).join(" → ")).join(" | ")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            Route geometry is re-timed with linear and turning top speeds scaled; accelerations,
            mission durations and measured times are unchanged.
          </p>
        </Section>
      )}

      <Section title="Model assumptions">
        <ul className="list-disc space-y-1 pl-5 text-muted">
          {result.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

export function StrategyPage({ client = api }: { client?: ApiClient }) {
  const scenario = useProjectStore((s) => s.scenario);
  const { result, status, error, run, scenarioKey: resultKey } = useStrategyStore();

  if (!scenario) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">No scenario loaded</h1>
        <p className="max-w-md text-muted">Load a scenario to choose and order its missions.</p>
        <Link
          to="/"
          className="rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent transition-colors hover:bg-accent-strong"
        >
          Choose a scenario
        </Link>
      </div>
    );
  }

  const stale = result !== null && resultKey !== scenarioKey(scenario);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold">Strategy</h1>
          <p className="text-muted">
            Choose and order missions to maximise the expected score within{" "}
            {formatSeconds(scenario.format.time_budget)}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run(scenario, client)}
          disabled={status === "running"}
          className="cursor-pointer rounded-md bg-accent px-4 py-2 font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
        >
          {status === "running" ? "Optimising…" : "Optimise"}
        </button>
      </header>
      {status === "error" && error && (
        <ErrorAlert>
          <p>{error.message}</p>
          {error.details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </ErrorAlert>
      )}
      {stale && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
          The scenario changed since this result was computed. Optimise again to update it.
        </p>
      )}
      {result && !stale && <Results scenario={scenario} result={result} />}
      {!result && status !== "running" && status !== "error" && (
        <p className="text-muted">
          Press Optimise to compute the best plan, a greedy baseline for comparison, and an
          explanation of every decision.
        </p>
      )}
    </div>
  );
}
