import { useRef, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { api } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";

import { OptimisationLesson } from "./OptimisationLesson";
import { PathfindingLesson } from "./PathfindingLesson";
import { SimulationLesson } from "./SimulationLesson";

type ApiClient = typeof api;

const TOPICS = [
  { id: "pathfinding", label: "Pathfinding" },
  { id: "optimisation", label: "Optimisation" },
  { id: "simulation", label: "Simulation" },
] as const;
type Topic = (typeof TOPICS)[number]["id"];

const isTopic = (value: string | null): value is Topic => TOPICS.some((t) => t.id === value);

/**
 * How RoboRoute reaches its answers, shown from the actual computation on the current scenario:
 * the recorded search trace, the DP's own counts and plan, and the simulation's running mean.
 */
export function LearnPage({ client = api }: { client?: ApiClient }) {
  const scenario = useProjectStore((s) => s.scenario);
  const [params, setParams] = useSearchParams();
  const requested = params.get("topic");
  const topic: Topic = isTopic(requested) ? requested : "pathfinding";
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!scenario) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">No scenario loaded</h1>
        <p className="max-w-md text-muted">
          The explanations are computed on your own scenario. Load one to begin.
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

  const select = (next: Topic) => {
    setParams({ topic: next }, { replace: true });
  };
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (offset === 0) return;
    event.preventDefault();
    const next = (index + offset + TOPICS.length) % TOPICS.length;
    const target = TOPICS[next];
    if (!target) return;
    select(target.id);
    tabs.current[next]?.focus();
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-lg font-semibold">Learn</h1>
        <p className="text-muted">
          How RoboRoute reaches its answers, replayed from the real computation on{" "}
          <span className="text-text">{scenario.name}</span>. Nothing here is a canned example.
        </p>
      </header>
      <div role="tablist" aria-label="Topics" className="flex gap-1 border-b border-border">
        {TOPICS.map((t, index) => (
          <button
            key={t.id}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={topic === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={topic === t.id ? 0 : -1}
            onClick={() => {
              select(t.id);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
            className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors ${
              topic === t.id
                ? "border-accent text-text"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${topic}`} aria-labelledby={`tab-${topic}`}>
        {topic === "pathfinding" && <PathfindingLesson scenario={scenario} client={client} />}
        {topic === "optimisation" && <OptimisationLesson scenario={scenario} client={client} />}
        {topic === "simulation" && <SimulationLesson scenario={scenario} client={client} />}
      </div>
    </div>
  );
}
