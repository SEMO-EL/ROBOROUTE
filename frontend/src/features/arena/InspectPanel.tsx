import type { ReactNode } from "react";

import type { Model, Scenario } from "@/lib/api/client";
import { formatAngle, formatLength, formatPoint, formatSeconds } from "@/lib/format/units";

import type { Selection } from "./ArenaLayers";

type Distribution = Model<"Fixed"> | Model<"Triangular"> | Model<"LogNormal"> | Model<"Empirical">;
type Shape = Model<"RectShape"> | Model<"CircleShape">;

function describeDistribution(d: Distribution): string {
  switch (d.kind) {
    case "fixed":
      return `${formatSeconds(d.value)} (fixed)`;
    case "triangular":
      return `${d.low} / ${d.mode} / ${d.high} s (min / likely / max)`;
    case "lognormal":
      return `lognormal, median ${formatSeconds(d.median)}, spread ×${d.gsd}`;
    case "empirical":
      return `${d.samples.length} measured samples`;
  }
}

function describeShape(shape: Shape): [string, string][] {
  if (shape.kind === "circle") {
    return [
      ["Shape", "circle"],
      ["Centre", formatPoint(shape.cx, shape.cy)],
      ["Radius", formatLength(shape.radius)],
    ];
  }
  return [
    ["Shape", "rectangle"],
    ["Centre", formatPoint(shape.cx, shape.cy)],
    ["Size", `${formatLength(shape.width)} × ${formatLength(shape.height)}`],
    ["Rotation", formatAngle(shape.rotation)],
  ];
}

function missionPoints(scenario: Scenario, missionId: string): number {
  return scenario.scoring.rules.reduce(
    (total, rule) =>
      rule.kind === "mission_points" && rule.mission === missionId ? total + rule.points : total,
    0,
  );
}

function Facts({
  title,
  rows,
  children,
}: {
  title: string;
  rows: [string, string][];
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{title}</h2>
      {children}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="font-mono text-xs leading-5">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-obstacle border-obstacle-edge", "Obstacle"],
    ["bg-nogo/20 border-nogo", "Keep-out area"],
    ["bg-home/10 border-home border-dashed", "Home zone"],
    ["bg-mission border-mission rounded-full", "Mission approach pose"],
    ["border-start border-dashed rounded-full", "Robot collision disc"],
  ];
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Legend</h2>
      <ul className="flex flex-col gap-1.5">
        {items.map(([swatch, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span aria-hidden="true" className={`size-3 border ${swatch}`} />
            {label}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Coordinates: origin at the bottom-left corner, x to the right, y up, headings
        counter-clockwise from x.
      </p>
    </section>
  );
}

export function InspectPanel({
  scenario,
  selection,
}: {
  scenario: Scenario;
  selection: Selection;
}) {
  let content: ReactNode;

  if (selection?.kind === "mission") {
    const mission = scenario.missions.find((m) => m.id === selection.id);
    if (mission) {
      const success =
        mission.success.kind === "probability"
          ? `${(mission.success.p * 100).toFixed(0)}% per attempt (entered)`
          : `${mission.success.successes} of ${mission.success.attempts} practice attempts`;
      content = (
        <Facts
          title={mission.name}
          rows={[
            ["Id", mission.id],
            ["Approach", formatPoint(mission.approach_pose.x, mission.approach_pose.y)],
            ["Heading", formatAngle(mission.approach_pose.theta)],
            ["Duration", describeDistribution(mission.execution_time)],
            ["Success", success],
            ["Max attempts", mission.max_attempts.toString()],
            ["Points", missionPoints(scenario, mission.id).toString()],
          ]}
        >
          {mission.description && <p className="text-muted">{mission.description}</p>}
        </Facts>
      );
    }
  } else if (selection?.kind === "obstacle") {
    const obstacle = scenario.arena.obstacles.find((o) => o.id === selection.id);
    if (obstacle) {
      content = (
        <Facts
          title={obstacle.label}
          rows={[
            ["Id", obstacle.id],
            ["Type", obstacle.kind === "no_go" ? "keep-out area" : "solid object"],
            ...describeShape(obstacle.shape),
          ]}
        />
      );
    }
  } else if (selection?.kind === "zone") {
    const zone = scenario.arena.home_zones.find((z) => z.id === selection.id);
    if (zone) {
      content = <Facts title={zone.label} rows={[["Id", zone.id], ...describeShape(zone.shape)]} />;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {content ?? (
        <p className="text-muted">Select a mission, obstacle or home zone to inspect it.</p>
      )}
      <Legend />
    </div>
  );
}
