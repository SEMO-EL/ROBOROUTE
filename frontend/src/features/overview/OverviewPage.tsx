import { useEffect, useState } from "react";

import { ErrorAlert } from "@/components/Alert";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";

import { ScenarioSummary } from "./ScenarioSummary";

type ApiClient = typeof api;
type ExampleSummary = Schemas["ExampleSummary"];

type ExamplesState =
  | { kind: "loading" }
  | { kind: "ready"; examples: ExampleSummary[] }
  | { kind: "error"; message: string };

export function OverviewPage({ client = api }: { client?: ApiClient }) {
  const [examples, setExamples] = useState<ExamplesState>({ kind: "loading" });
  const scenario = useProjectStore((s) => s.scenario);
  const status = useProjectStore((s) => s.status);
  const loadError = useProjectStore((s) => s.error);
  const loadExample = useProjectStore((s) => s.loadExample);

  useEffect(() => {
    let cancelled = false;
    unwrap(client.GET("/api/v1/examples"))
      .then((list) => {
        if (!cancelled) setExamples({ kind: "ready", examples: list });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setExamples({ kind: "error", message: error instanceof Error ? error.message : "" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="mt-1 max-w-2xl text-muted">
          RoboRoute plans routes, selects missions and simulates strategies for robot games. Start
          from an example scenario; every number it shows is labelled as modelled, measured or
          simulated.
        </p>
      </header>

      <section aria-labelledby="examples-title" className="flex flex-col gap-2">
        <h2 id="examples-title" className="text-xs font-medium tracking-wide text-muted uppercase">
          Example scenarios
        </h2>
        {examples.kind === "loading" && <p className="text-muted">Loading examples…</p>}
        {examples.kind === "error" && <ErrorAlert>{examples.message}</ErrorAlert>}
        {examples.kind === "ready" && (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {examples.examples.map((example) => (
              <li key={example.id}>
                <button
                  type="button"
                  onClick={() => void loadExample(example.id, client)}
                  aria-pressed={scenario?.id === example.id}
                  className="flex w-full cursor-pointer flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-surface-2 aria-pressed:bg-surface-2"
                >
                  <span className="font-medium">{example.name}</span>
                  <span className="text-muted">{example.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {status === "loading" && <p className="text-muted">Loading scenario…</p>}
      {status === "error" && loadError && <ErrorAlert>{loadError}</ErrorAlert>}
      {scenario && <ScenarioSummary scenario={scenario} />}
    </div>
  );
}
