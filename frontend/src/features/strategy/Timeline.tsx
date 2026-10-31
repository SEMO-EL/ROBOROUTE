import { formatSeconds } from "@/lib/format/units";

export interface TimelineStep {
  kind: "travel" | "mission" | "reset";
  from_node: string;
  to_node: string;
  seconds: number;
  provenance?: string;
}

const COLOURS: Record<TimelineStep["kind"], string> = {
  travel: "bg-muted/40",
  mission: "bg-accent",
  reset: "bg-warning/70",
};

function describe(step: TimelineStep, names: Record<string, string>): string {
  const name = (id: string) => names[id] ?? id;
  const time = formatSeconds(Number(step.seconds.toFixed(1)));
  if (step.kind === "travel")
    return `Travel ${name(step.from_node)} → ${name(step.to_node)}: ${time}${
      step.provenance === "measured" ? " (measured)" : ""
    }`;
  if (step.kind === "reset") return `Back in home, attachment change: ${time}`;
  return `${name(step.to_node)}: ${time}`;
}

/** The plan as a bar over the whole time budget: travel, mission work and resets. */
export function Timeline({
  steps,
  budget,
  names,
}: {
  steps: readonly TimelineStep[];
  budget: number;
  names: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-6 w-full overflow-hidden rounded border border-border bg-surface-2"
        role="img"
        aria-label={`Plan timeline over a ${formatSeconds(budget)} budget`}
      >
        {steps.map((step, index) => (
          <div
            // Steps have no identity of their own; their position in the plan is the identity.
            key={index}
            title={describe(step, names)}
            className={`h-full border-r border-bg/60 ${COLOURS[step.kind]}`}
            style={{ width: `${(step.seconds / budget) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted/40" /> Travel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent" /> Mission
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-warning/70" /> Reset in home
        </span>
        <span className="ml-auto font-mono">{formatSeconds(budget)} budget</span>
      </div>
    </div>
  );
}
