import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { ErrorAlert } from "@/components/Alert";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { blankScenario } from "@/lib/scenario/blank";
import { useProjectStore } from "@/stores/project";

import { Projects } from "./Projects";
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
  const replace = useProjectStore((s) => s.replace);
  const navigate = useNavigate();
  // The summary of a chosen example appears below the list, often off screen: scroll to it.
  const scrollToSummary = useRef(false);

  function startBlank(kind: "single_run" | "multi_run") {
    replace(blankScenario(kind));
    void navigate("/arena");
  }

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

      <Projects client={client} />

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
                  onClick={() => {
                    scrollToSummary.current = true;
                    void loadExample(example.id, client);
                  }}
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

      <section aria-labelledby="blank-title" className="flex flex-col gap-2">
        <h2 id="blank-title" className="text-xs font-medium tracking-wide text-muted uppercase">
          Or start from a blank field
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              startBlank("multi_run");
            }}
            className="cursor-pointer rounded-md border border-border bg-surface px-3 py-2 text-left hover:bg-surface-2"
          >
            <span className="block font-medium">Several runs from home</span>
            <span className="text-xs text-muted">FLL Challenge style · 150 s match</span>
          </button>
          <button
            type="button"
            onClick={() => {
              startBlank("single_run");
            }}
            className="cursor-pointer rounded-md border border-border bg-surface px-3 py-2 text-left hover:bg-surface-2"
          >
            <span className="block font-medium">One continuous run</span>
            <span className="text-xs text-muted">WRO RoboMission style · 120 s attempt</span>
          </button>
        </div>
        <p className="text-xs text-muted">
          Set the field size, obstacles and missions to match your own table and season rules.
        </p>
      </section>

      {status === "loading" && <p className="text-muted">Loading scenario…</p>}
      {status === "error" && loadError && <ErrorAlert>{loadError}</ErrorAlert>}
      {scenario && (
        <div
          ref={(node) => {
            if (node && scrollToSummary.current) {
              scrollToSummary.current = false;
              node.scrollIntoView({ block: "start" });
            }
          }}
        >
          <ScenarioSummary scenario={scenario} />
        </div>
      )}
    </div>
  );
}
