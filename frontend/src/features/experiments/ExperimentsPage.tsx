import { CircleCheck, Download, Eye, FileSpreadsheet, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ErrorAlert } from "@/components/Alert";
import { EcdfChart } from "@/components/charts/EcdfChart";
import { Insight, Ranking } from "@/features/simulation/results";
import { api } from "@/lib/api/client";
import { simulate, simulateTrialsCsv, type SimulateResult } from "@/lib/api/endpoints";
import { download, experimentFile, safeFilename } from "@/lib/storage/files";
import type { Repository, StoredExperiment } from "@/lib/storage/repository";
import { experiments as experimentRepo } from "@/stores/persistence";

type ApiClient = typeof api;

const fmt = (value: number) => value.toFixed(1);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const iconButton =
  "flex size-8 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-40";

type Reproduction =
  | { kind: "running" }
  | { kind: "same" }
  | { kind: "different"; detail: string }
  | { kind: "error"; message: string };

/** Compare the statistical content of two results (timing and metadata aside). */
function sameResults(a: SimulateResult, b: SimulateResult): boolean {
  return JSON.stringify([a.plans, a.differences]) === JSON.stringify([b.plans, b.differences]);
}

function versionChanges(saved: SimulateResult, now: SimulateResult): string {
  const changes: string[] = [];
  if (saved.metadata.engine_version !== now.metadata.engine_version) {
    changes.push(`engine ${saved.metadata.engine_version} → ${now.metadata.engine_version}`);
  }
  if (saved.metadata.numpy_version !== now.metadata.numpy_version) {
    changes.push(`NumPy ${saved.metadata.numpy_version} → ${now.metadata.numpy_version}`);
  }
  return changes.length
    ? `Versions changed: ${changes.join(", ")}.`
    : "Same versions — please report this as a bug.";
}

function Detail({ experiment, client }: { experiment: StoredExperiment; client: ApiClient }) {
  const [reproduction, setReproduction] = useState<Reproduction | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const { result, request } = experiment;
  const target = request.config.target_score;

  async function reproduce() {
    setReproduction({ kind: "running" });
    try {
      const now = await simulate(client, request);
      if (
        sameResults(experiment.result, now) &&
        now.metadata.input_hash === experiment.result.metadata.input_hash
      ) {
        setReproduction({ kind: "same" });
      } else {
        setReproduction({ kind: "different", detail: versionChanges(experiment.result, now) });
      }
    } catch (error) {
      setReproduction({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function exportCsv() {
    setCsvError(null);
    try {
      download(
        `${safeFilename(experiment.name)}-trials.csv`,
        await simulateTrialsCsv(client, request),
        "text/csv",
      );
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section
      aria-label={`Experiment ${experiment.name}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">{experiment.name}</h2>
        <button
          type="button"
          onClick={() => void reproduce()}
          disabled={reproduction?.kind === "running"}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface-2"
        >
          <RefreshCw aria-hidden="true" className="size-4" /> Reproduce
        </button>
        <button
          type="button"
          onClick={() => void exportCsv()}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface-2"
        >
          <FileSpreadsheet aria-hidden="true" className="size-4" /> Trials CSV
        </button>
      </header>
      {reproduction?.kind === "running" && (
        <p className="text-muted">Re-running with the saved seed…</p>
      )}
      {reproduction?.kind === "same" && (
        <p className="flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-success">
          <CircleCheck aria-hidden="true" className="size-4" /> Reproduced exactly: the same inputs
          and seed gave identical results.
        </p>
      )}
      {reproduction?.kind === "different" && (
        <ErrorAlert>Results differ from the saved run. {reproduction.detail}</ErrorAlert>
      )}
      {reproduction?.kind === "error" && <ErrorAlert>{reproduction.message}</ErrorAlert>}
      {csvError && <ErrorAlert>{csvError}</ErrorAlert>}
      <Insight result={result} />
      <Ranking result={result} target={target} />
      <EcdfChart
        title="Score distribution by plan"
        xLabel="Score (points)"
        series={result.plans.map((plan) => ({ label: plan.label, points: plan.score_ecdf }))}
        target={target}
      />
      <p className="font-mono text-xs text-muted">
        {request.scenario.name} · seed {result.metadata.seed} ·{" "}
        {result.metadata.trials.toLocaleString("en")} trials per plan · engine{" "}
        {result.metadata.engine_version} · NumPy {result.metadata.numpy_version} · input{" "}
        {result.metadata.input_hash.slice(0, 12)}…
      </p>
    </section>
  );
}

function Comparison({ chosen }: { chosen: StoredExperiment[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-2 font-semibold">Comparison</h2>
      <div className="overflow-x-auto">
        <table aria-label="Experiment comparison" className="w-full text-left">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Experiment</th>
              <th className="py-1.5 pr-3 font-medium">Plan</th>
              <th className="py-1.5 pr-3 font-medium">Mean (95% CI)</th>
              <th className="py-1.5 pr-3 font-medium">P(score ≥ target)</th>
              <th className="py-1.5 font-medium">Cut off</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px]">
            {chosen.flatMap((experiment) =>
              experiment.result.plans.map((plan) => (
                <tr key={`${experiment.id}-${plan.label}`} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-sans">{experiment.name}</td>
                  <td className="py-1.5 pr-3 font-sans">{plan.label}</td>
                  <td className="py-1.5 pr-3">
                    {fmt(plan.score.mean)}{" "}
                    <span className="text-muted">
                      ({fmt(plan.score.mean_ci.low)}–{fmt(plan.score.mean_ci.high)})
                    </span>
                  </td>
                  <td className="py-1.5 pr-3">
                    {plan.probability_target
                      ? `${pct(plan.probability_target.estimate)} (≥ ${experiment.request.config.target_score ?? "?"})`
                      : "—"}
                  </td>
                  <td className="py-1.5">{pct(plan.probability_cut_off.estimate)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Experiments with different scenarios, seeds or settings are not paired: compare their
        intervals, not single numbers.
      </p>
    </section>
  );
}

export function ExperimentsPage({
  repository = experimentRepo,
  client = api,
}: {
  repository?: Repository<StoredExperiment>;
  client?: ApiClient;
}) {
  const [, refresh] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const { items, warnings } = repository.list();
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const current = sorted.find((e) => e.id === selected) ?? null;
  const chosen = sorted.filter((e) => compare.includes(e.id));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-lg font-semibold">Experiments</h1>
        <p className="text-muted">
          Saved simulation runs. Each one stores its inputs and seed, so it can be reproduced
          exactly and exported.
        </p>
      </header>
      {warnings.map((warning) => (
        <p key={warning} className="text-xs text-warning">
          {warning}
        </p>
      ))}
      {sorted.length === 0 ? (
        <p className="text-muted">
          No experiments yet. Run a simulation and choose “Save as experiment” on the{" "}
          <Link
            to="/simulation"
            className="text-accent underline underline-offset-2 hover:text-accent-strong"
          >
            Simulation page
          </Link>
          .
        </p>
      ) : (
        <ul
          aria-label="Experiments"
          className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface"
        >
          {sorted.map((experiment) => (
            <li key={experiment.id} className="flex items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                className="accent-accent"
                aria-label={`Compare ${experiment.name}`}
                checked={compare.includes(experiment.id)}
                onChange={() => {
                  setCompare((c) =>
                    c.includes(experiment.id)
                      ? c.filter((x) => x !== experiment.id)
                      : [...c, experiment.id],
                  );
                }}
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{experiment.name}</h3>
                <div className="text-xs text-muted">
                  {experiment.request.scenario.name} ·{" "}
                  {experiment.request.plans.map((p) => p.label).join(" vs ")} ·{" "}
                  {new Date(experiment.createdAt).toLocaleString()}
                </div>
              </div>
              {confirming === experiment.id ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Delete for good?</span>
                  <button
                    type="button"
                    aria-label="Confirm delete"
                    onClick={() => {
                      repository.remove(experiment.id);
                      setConfirming(null);
                      if (selected === experiment.id) setSelected(null);
                      refresh((n) => n + 1);
                    }}
                    className="cursor-pointer rounded-md bg-danger/20 px-2 py-1 text-danger hover:bg-danger/30"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(null);
                    }}
                    className="cursor-pointer rounded-md px-2 py-1 text-muted hover:text-text"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`View ${experiment.name}`}
                    title="View"
                    className={iconButton}
                    onClick={() => {
                      setSelected(experiment.id);
                    }}
                  >
                    <Eye aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Export ${experiment.name}`}
                    title="Export as a file"
                    className={iconButton}
                    onClick={() => {
                      download(
                        `${safeFilename(experiment.name)}.roboroute-experiment.json`,
                        experimentFile(experiment),
                      );
                    }}
                  >
                    <Download aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${experiment.name}`}
                    title="Delete"
                    className={iconButton}
                    onClick={() => {
                      setConfirming(experiment.id);
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {chosen.length >= 2 && <Comparison chosen={chosen} />}
      {current && <Detail key={current.id} experiment={current} client={client} />}
    </div>
  );
}
