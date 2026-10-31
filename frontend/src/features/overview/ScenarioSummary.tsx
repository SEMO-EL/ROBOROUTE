import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import type { Scenario } from "@/lib/api/client";
import { formatLength, formatSeconds } from "@/lib/format/units";
import { footprintRadius } from "@/lib/robot/footprint";

import { LatestResults } from "./LatestResults";

const FORMAT_LABELS: Record<Scenario["format"]["kind"], string> = {
  single_run: "Single run — one continuous attempt (WRO-style)",
  multi_run: "Multiple runs — return to home between runs (FLL-style)",
};

export function ScenarioSummary({ scenario }: { scenario: Scenario }) {
  const { arena, robot, format } = scenario;
  const facts: [string, string][] = [
    ["Field", `${formatLength(arena.width)} × ${formatLength(arena.height)}`],
    ["Grid resolution", formatLength(arena.grid_resolution)],
    ["Obstacles", arena.obstacles.length.toString()],
    ["Missions", scenario.missions.length.toString()],
    ["Constraints", scenario.constraints.length.toString()],
    ["Match format", FORMAT_LABELS[format.kind]],
    ["Time budget", formatSeconds(format.time_budget)],
    ["Robot", `${robot.name} (${formatLength(robot.length)} × ${formatLength(robot.width)})`],
    ["Collision radius", formatLength(footprintRadius(robot))],
  ];

  return (
    <section
      aria-labelledby="scenario-title"
      className="rounded-lg border border-border bg-surface"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 id="scenario-title" className="font-semibold">
          {scenario.name}
        </h2>
        {scenario.fictional && (
          <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
            Fictional data
          </span>
        )}
      </header>
      {scenario.description && (
        <p className="border-b border-border px-4 py-3 text-muted">{scenario.description}</p>
      )}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 px-4 py-3">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="font-mono text-[13px]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-border px-4 py-3">
        <LatestResults scenario={scenario} />
      </div>
      <footer className="border-t border-border px-4 py-3">
        <Link
          to="/arena"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent transition-colors hover:bg-accent-strong"
        >
          Open arena <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </footer>
    </section>
  );
}
