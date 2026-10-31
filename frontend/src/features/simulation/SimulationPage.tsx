import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { ErrorAlert } from "@/components/Alert";
import { EcdfChart } from "@/components/charts/EcdfChart";
import { Histogram } from "@/components/charts/Histogram";
import { RateBars } from "@/components/charts/RateBars";
import { api } from "@/lib/api/client";
import type { OptimizeResult, SimulateResult } from "@/lib/api/endpoints";
import type { Repository, StoredExperiment } from "@/lib/storage/repository";
import { experiments as experimentRepo } from "@/stores/persistence";
import { newProjectId, useProjectStore } from "@/stores/project";
import { useSimulationStore } from "@/stores/simulation";

import { Insight, Ranking } from "./results";
import { scenarioKey, useStrategyStore } from "@/stores/strategy";

type ApiClient = typeof api;
type SimulatedPlan = SimulateResult["plans"][number];

const MAX_PLANS = 3;
const TRIAL_OPTIONS = [1_000, 5_000, 10_000, 20_000];

interface Candidate {
  label: string;
  runs: string[][];
  expected: number;
}

function candidates(result: OptimizeResult): Candidate[] {
  const list: Candidate[] = [];
  if (result.optimal) {
    list.push({
      label: "Optimal",
      runs: result.optimal.runs,
      expected: result.optimal.expected_score,
    });
  }
  list.push({ label: "Greedy", runs: result.greedy.runs, expected: result.greedy.expected_score });
  result.alternatives.forEach((alternative, index) => {
    list.push({
      label: `Alternative ${index + 1}`,
      runs: alternative.runs,
      expected: alternative.expected_score,
    });
  });
  return list;
}

const fmt = (value: number, digits = 1) => value.toFixed(digits);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1" title={hint}>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const inputClass = "rounded-md border border-border bg-surface-2 px-2 py-1.5 font-mono text-text";

function PlanDetail({
  plan,
  budget,
  target,
  names,
}: {
  plan: SimulatedPlan;
  budget: number;
  target: number | null;
  names: Record<string, string>;
}) {
  const q = plan.score.quantiles;
  const tiles: [string, string, string?][] = [
    [
      "Mean score",
      fmt(plan.score.mean),
      `95% CI ${fmt(plan.score.mean_ci.low)}–${fmt(plan.score.mean_ci.high)}`,
    ],
    [
      "Median",
      fmt(q.median?.estimate ?? 0, 0),
      `10th–90th percentile ${fmt(q.p10?.estimate ?? 0, 0)}–${fmt(q.p90?.estimate ?? 0, 0)}`,
    ],
    [
      "Cut off by buzzer",
      pct(plan.probability_cut_off.estimate),
      "Trials where time ran out during travel or a mission",
    ],
  ];
  if (plan.probability_target && target !== null) {
    tiles.push([
      `P(score ≥ ${target})`,
      pct(plan.probability_target.estimate),
      `95% CI ${pct(plan.probability_target.interval.low)}–${pct(plan.probability_target.interval.high)}`,
    ]);
  }
  const markers = [{ value: plan.score.mean, label: "mean" }];
  if (target !== null) markers.push({ value: target, label: "target" });
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted">{label}</span>
            <span className="font-mono text-xl">{value}</span>
            {hint && <span className="text-xs text-muted">{hint}</span>}
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Histogram
          title="Score distribution"
          subtitle="Share of simulated matches in each score range"
          edges={plan.score_histogram.edges}
          counts={plan.score_histogram.counts}
          xLabel="Score (points)"
          formatBin={(lo, hi) => `${fmt(lo, 0)}–${fmt(hi, 0)} pts`}
          markers={markers}
        />
        <Histogram
          title="Completion time"
          subtitle="When the robot finished the plan (the budget if the buzzer stopped it)"
          edges={plan.completion_histogram.edges}
          counts={plan.completion_histogram.counts}
          xLabel="Time (s)"
          formatBin={(lo, hi) => `${fmt(lo, 0)}–${fmt(hi, 0)} s`}
          markers={[{ value: budget, label: "budget" }]}
        />
      </div>
      <RateBars
        title="Mission success rate"
        subtitle="Share of all simulated matches in which each mission succeeded, with 95% interval. Missions late in the plan are sometimes not reached."
        rows={plan.missions.map((m) => ({
          label: names[m.mission] ?? m.mission,
          estimate: m.succeeded.estimate,
          low: m.succeeded.interval.low,
          high: m.succeeded.interval.high,
          note:
            m.started.estimate < 0.995
              ? `started in ${pct(m.started.estimate)} of matches`
              : undefined,
        }))}
      />
    </div>
  );
}

export function SimulationPage({
  client = api,
  experiments = experimentRepo,
}: {
  client?: ApiClient;
  experiments?: Repository<StoredExperiment>;
}) {
  const scenario = useProjectStore((s) => s.scenario);
  const projectId = useProjectStore((s) => s.projectId);
  const [saved, setSaved] = useState<{ ok: boolean; text: string } | null>(null);
  const strategy = useStrategyStore();
  const { result, request, status, error, run } = useSimulationStore();
  const [selected, setSelected] = useState<string[]>(["Optimal", "Greedy"]);
  const [trials, setTrials] = useState(10_000);
  const [seed, setSeed] = useState(1);
  const [cv, setCv] = useState(10);
  const [target, setTarget] = useState<string>("");
  const [skip, setSkip] = useState(true);
  const [detail, setDetail] = useState(0);

  if (!scenario) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">No scenario loaded</h1>
        <p className="max-w-md text-muted">
          Load a scenario, optimise it, then simulate the plans.
        </p>
        <Link
          to="/"
          className="rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent hover:bg-accent-strong"
        >
          Choose a scenario
        </Link>
      </div>
    );
  }

  const key = scenarioKey(scenario);
  const optimisation = strategy.result && strategy.scenarioKey === key ? strategy.result : null;
  const plans = optimisation ? candidates(optimisation) : [];
  const targetScore = target.trim() === "" ? null : Number(target);
  const names = Object.fromEntries(scenario.missions.map((m) => [m.id, m.name]));
  const current = result && useSimulationStore.getState().scenarioKey === key ? result : null;

  function toggle(label: string) {
    setSelected((previous) =>
      previous.includes(label)
        ? previous.filter((l) => l !== label)
        : [...previous, label].slice(0, MAX_PLANS),
    );
  }

  function start() {
    if (!scenario) return;
    const chosen = plans.filter((p) => selected.includes(p.label));
    setDetail(0);
    setSaved(null);
    void run(
      {
        scenario,
        plans: chosen.map((p) => ({ label: p.label, runs: p.runs })),
        config: {
          trials,
          seed,
          travel_time_cv: cv / 100,
          skip_if_insufficient_time: skip,
          target_score: targetScore !== null && Number.isFinite(targetScore) ? targetScore : null,
        },
      },
      client,
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-lg font-semibold">Simulation</h1>
        <p className="text-muted">
          Play each plan thousands of times with random durations and outcomes to see how it behaves
          under uncertainty — not just on average.
        </p>
      </header>

      {!optimisation ? (
        <section className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-muted">
            Simulation compares the plans found by the optimiser. Optimise this scenario first.
          </p>
          <button
            type="button"
            onClick={() => void strategy.run(scenario, client)}
            disabled={strategy.status === "running"}
            className="cursor-pointer rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent hover:bg-accent-strong disabled:opacity-60"
          >
            {strategy.status === "running" ? "Optimising…" : "Optimise now"}
          </button>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs text-muted">
              Plans to simulate (up to {MAX_PLANS})
            </legend>
            {plans.map((plan) => {
              const checked = selected.includes(plan.label);
              return (
                <label key={plan.label} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={checked}
                    disabled={!checked && selected.length >= MAX_PLANS}
                    onChange={() => {
                      toggle(plan.label);
                    }}
                  />
                  <span>{plan.label}</span>
                  <span className="font-mono text-xs text-muted">
                    {fmt(plan.expected)} expected (planning model)
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Trials">
              {(id) => (
                <select
                  id={id}
                  className={inputClass}
                  value={trials}
                  onChange={(e) => {
                    setTrials(Number(e.target.value));
                  }}
                >
                  {TRIAL_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n.toLocaleString("en")}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Random seed" hint="The same seed gives exactly the same results">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  className={inputClass}
                  value={seed}
                  onChange={(e) => {
                    setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)));
                  }}
                />
              )}
            </Field>
            <Field
              label="Travel time spread (%)"
              hint="Coefficient of variation of every travel leg"
            >
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={cv}
                  onChange={(e) => {
                    setCv(Math.min(100, Math.max(0, Number(e.target.value) || 0)));
                  }}
                />
              )}
            </Field>
            <Field label="Target score" hint="Optional: estimate the probability of reaching it">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  placeholder="none"
                  className={inputClass}
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                  }}
                />
              )}
            </Field>
            <label
              className="flex cursor-pointer items-end gap-2 pb-2 text-sm"
              title="Skip a mission when its planned duration no longer fits"
            >
              <input
                type="checkbox"
                className="accent-accent"
                checked={skip}
                onChange={(e) => {
                  setSkip(e.target.checked);
                }}
              />
              Skip if time is short
            </label>
          </div>
          <div>
            <button
              type="button"
              onClick={start}
              disabled={selected.length === 0 || status === "running"}
              className="cursor-pointer rounded-md bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "running" ? "Simulating…" : "Run simulation"}
            </button>
          </div>
        </section>
      )}

      {status === "error" && error && <ErrorAlert>{error}</ErrorAlert>}

      {current && (
        <>
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-semibold">Plans compared</h2>
              <button
                type="button"
                disabled={!request}
                onClick={() => {
                  if (!request) return;
                  const name = `${scenario.name} — ${request.plans.map((p) => p.label).join(" vs ")}`;
                  try {
                    experiments.save({
                      id: newProjectId(),
                      name,
                      createdAt: new Date().toISOString(),
                      projectId,
                      request,
                      result: current,
                    });
                    setSaved({ ok: true, text: `Saved as “${name}”.` });
                  } catch (cause) {
                    setSaved({
                      ok: false,
                      text: cause instanceof Error ? cause.message : String(cause),
                    });
                  }
                }}
                className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface-2 disabled:opacity-50"
              >
                Save as experiment
              </button>
            </div>
            {saved?.ok && (
              <p className="text-sm text-success">
                {saved.text}{" "}
                <Link to="/experiments" className="underline underline-offset-2">
                  Open experiments
                </Link>
              </p>
            )}
            {saved && !saved.ok && <ErrorAlert>{saved.text}</ErrorAlert>}
            <Insight result={current} />
            <Ranking
              result={current}
              target={current.plans[0]?.probability_target ? targetScore : null}
            />
            <EcdfChart
              title="Score distribution by plan"
              subtitle="Share of simulated matches scoring at most x points — a curve further right is better"
              xLabel="Score (points)"
              series={current.plans.map((plan) => ({ label: plan.label, points: plan.score_ecdf }))}
              target={targetScore}
            />
          </section>
          <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
            <div role="tablist" aria-label="Plan details" className="flex gap-2">
              {current.plans.map((plan, index) => (
                <button
                  key={plan.label}
                  type="button"
                  role="tab"
                  aria-selected={detail === index}
                  onClick={() => {
                    setDetail(index);
                  }}
                  className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-sm aria-selected:border-accent aria-selected:text-accent"
                >
                  {plan.label}
                </button>
              ))}
            </div>
            {current.plans[detail] && (
              <PlanDetail
                plan={current.plans[detail]}
                budget={scenario.format.time_budget}
                target={targetScore}
                names={names}
              />
            )}
          </section>
          <section className="rounded-lg border border-border bg-surface p-4 text-xs text-muted">
            <h2 className="mb-2 text-sm font-semibold text-text">
              Reproducibility and assumptions
            </h2>
            <p className="font-mono">
              seed {current.metadata.seed} · {current.metadata.trials.toLocaleString("en")} trials
              per plan · engine {current.metadata.engine_version} · NumPy{" "}
              {current.metadata.numpy_version} · input {current.metadata.input_hash.slice(0, 12)}…
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {current.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
