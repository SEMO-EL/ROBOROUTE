import { useId, useState } from "react";

import { ErrorAlert } from "@/components/Alert";
import { ConvergenceChart } from "@/components/charts/ConvergenceChart";
import { api, type Model, type Scenario } from "@/lib/api/client";
import { simulate, type SimulateBody, type SimulateResult } from "@/lib/api/endpoints";
import { describeDistribution, distributionMean } from "@/lib/scenario/distributions";
import { useSimulationStore } from "@/stores/simulation";
import { scenarioKey, useStrategyStore } from "@/stores/strategy";

import { Card, Formula, Missing, primaryButton } from "./ui";

type ApiClient = typeof api;
type Mission = Model<"Mission-Output">;

const LESSON_TRIALS = 5_000;

interface Run {
  result: SimulateResult;
  body: SimulateBody;
  key: string;
}

export function SimulationLesson({ scenario, client }: { scenario: Scenario; client: ApiClient }) {
  const stored = useSimulationStore();
  const [local, setLocal] = useState<Run | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planIndex, setPlanIndex] = useState(0);
  const selectId = useId();

  if (scenario.missions.length === 0) {
    return (
      <Missing to="/missions" action="Add missions">
        There are no missions to simulate yet. A simulation plays a plan of missions many times with
        random durations and outcomes.
      </Missing>
    );
  }

  const key = scenarioKey(scenario);
  // Prefer the user's own run from the Simulation page; otherwise one made here (kept local so it
  // never replaces the Simulation page's results).
  const source: Run | null =
    stored.result && stored.request && stored.scenarioKey === key
      ? { result: stored.result, body: stored.request, key }
      : local?.key === key
        ? local
        : null;

  async function simulateOptimal() {
    setPending(true);
    setError(null);
    try {
      const strategy = useStrategyStore.getState();
      let optimisation = strategy.scenarioKey === key ? strategy.result : null;
      if (!optimisation) {
        await strategy.run(scenario, client);
        const after = useStrategyStore.getState();
        optimisation = after.scenarioKey === key ? after.result : null;
        if (!optimisation) throw new Error(after.error?.message ?? "Optimisation failed.");
      }
      const plan = optimisation.optimal
        ? { label: "Optimal", runs: optimisation.optimal.runs }
        : { label: "Greedy", runs: optimisation.greedy.runs };
      const body: SimulateBody = {
        scenario,
        plans: [plan],
        config: {
          trials: LESSON_TRIALS,
          seed: 1,
          travel_time_cv: 0.1,
          skip_if_insufficient_time: true,
          target_score: null,
        },
      };
      setLocal({ result: await simulate(client, body), body, key });
      setPlanIndex(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  }

  if (!source) {
    return (
      <Card title="Monte Carlo simulation">
        <p>
          The optimiser plans with average durations. A real match is random: missions take more or
          less time and sometimes fail. A Monte Carlo simulation plays the plan thousands of times,
          drawing every random quantity afresh, and summarises what happened.
        </p>
        <p className="text-muted">
          No simulation of this scenario yet. Run one here, or on the Simulation page to compare
          plans.
        </p>
        <button
          type="button"
          className={primaryButton}
          disabled={pending}
          onClick={() => void simulateOptimal()}
        >
          {pending
            ? "Simulating…"
            : `Simulate the optimal plan (${LESSON_TRIALS.toLocaleString()} trials)`}
        </button>
        {error && <ErrorAlert>{error}</ErrorAlert>}
      </Card>
    );
  }

  const plans = source.result.plans;
  const plan = plans[Math.min(planIndex, plans.length - 1)];
  if (!plan) return null;
  const config = source.body.config;
  const byId = new Map(scenario.missions.map((m) => [m.id, m]));
  const missions = plan.runs.flat().flatMap((id) => {
    const mission = byId.get(id);
    return mission ? [mission] : [];
  });
  const last = plan.convergence[plan.convergence.length - 1];
  const half = last ? (last.interval.high - last.interval.low) / 2 : 0;

  return (
    <div className="flex flex-col gap-4">
      {plans.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={selectId} className="text-muted">
            Plan
          </label>
          <select
            id={selectId}
            value={planIndex}
            onChange={(e) => {
              setPlanIndex(Number(e.target.value));
            }}
            className="rounded-md border border-border bg-surface-2 px-2 py-1 text-text"
          >
            {plans.map((p, index) => (
              <option key={p.label} value={index}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <Card title="What one simulated match draws">
        <p>
          Each of the {config.trials.toLocaleString()} trials (seed {config.seed}) plays the plan
          once with fresh random values:
        </p>
        <table className="w-full text-left text-xs [&_td]:py-1 [&_td]:pr-4 [&_th]:pr-4 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
          <caption className="mb-1 text-left text-muted">
            Random variables in each trial, mission by mission
          </caption>
          <thead className="text-faint">
            <tr>
              <th scope="col" className="py-1 font-normal">
                Mission
              </th>
              <th scope="col" className="font-normal">
                Time per attempt
              </th>
              <th scope="col" className="text-right font-normal">
                Average
              </th>
              <th scope="col" className="font-normal">
                Success per attempt
              </th>
              <th scope="col" className="text-right font-normal">
                Attempts
              </th>
            </tr>
          </thead>
          <tbody>
            {missions.map((m) => (
              <tr key={m.id} className="border-t border-border align-top">
                <td>{m.name}</td>
                <td>
                  {describeDistribution(m.execution_time)}
                  {m.retry_time && (
                    <div className="text-faint">retries: {describeDistribution(m.retry_time)}</div>
                  )}
                </td>
                <td className="text-right font-mono whitespace-nowrap">
                  {distributionMean(m.execution_time).toFixed(1)} s
                </td>
                <td>
                  <SuccessText success={m.success} />
                </td>
                <td className="text-right font-mono">{m.max_attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Every travel leg&apos;s modelled time is multiplied by a random factor F, lognormal with
          mean 1 and coefficient of variation {Math.round(config.travel_time_cv * 100)} %:
        </p>
        <Formula>{`σ² = ln(1 + cv²),   ln F ~ Normal(−σ²/2, σ²)   so that  E[F] = 1`}</Formula>
        <p className="text-muted">
          A failed attempt is retried up to the mission&apos;s limit; a mission whose required
          mission failed is skipped
          {config.skip_if_insufficient_time
            ? "; a mission is skipped when its planned time no longer fits in what remains"
            : ""}
          . The buzzer is hard: a mission still running when time is up scores nothing.
        </p>
      </Card>

      <Card title="How the estimate settles">
        <ConvergenceChart
          title="Running mean score"
          subtitle={`${plan.label}: average score of the first n trials, with its 95 % interval`}
          points={plan.convergence}
          reference={plan.analytic_expected_score}
        />
        {last && (
          <p>
            After {last.trials.toLocaleString()} trials the mean score is {last.mean.toFixed(1)} ±{" "}
            {half.toFixed(1)}. The interval narrows like 1/√n: four times as many trials halve its
            width, which is why the last column of the table stays roughly constant.
          </p>
        )}
        <p className="text-muted">
          The planning model expects {plan.analytic_expected_score.toFixed(1)} points. The
          simulation need not converge to that value: it also includes travel-time noise, missions
          skipped for lack of time and missions cut off by the buzzer, which the planning model
          leaves out. The interval measures the simulation&apos;s own sampling error, not how well
          the model matches a real robot.
        </p>
      </Card>
    </div>
  );
}

function SuccessText({ success }: { success: Mission["success"] }) {
  if (success.kind === "probability") {
    return <span className="font-mono">{(success.p * 100).toFixed(0)} %</span>;
  }
  const p = (success.successes + 1) / (success.attempts + 2);
  return (
    <span>
      <span className="font-mono">{(p * 100).toFixed(0)} %</span>{" "}
      <span className="text-faint">
        ({success.successes} of {success.attempts} practice runs: (s + 1) / (n + 2))
      </span>
    </span>
  );
}
