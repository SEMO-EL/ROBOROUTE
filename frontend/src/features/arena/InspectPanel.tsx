import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { NumberField, TextField } from "@/components/NumberField";
import type { Scenario } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";

import {
  deleteSelection,
  setHeading,
  updateMission,
  updateObstacle,
  updateShape,
  updateZone,
} from "./editing";
import type { Selection } from "./selection";
import type { ValidationState } from "./useValidation";

const MAX_LENGTH = 20; // metres; matches the backend's bounds

function Section({
  title,
  children,
  onDelete,
}: {
  title: string;
  children: ReactNode;
  onDelete?: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-danger/10 hover:text-danger"
            title="Delete (Del)"
          >
            <Trash2 aria-hidden="true" className="size-3.5" /> Delete
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

const grid = "grid grid-cols-2 gap-3";

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
        counter-clockwise from x. Drag objects to move them; drag the handle of a selected mission
        or start pose to turn it.
      </p>
    </section>
  );
}

function Issues({ validation }: { validation: ValidationState }) {
  if (validation.kind !== "done" || validation.issues.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Problems">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Problems</h2>
      <ul className="flex flex-col gap-1.5">
        {validation.issues.map((issue) => (
          <li
            key={`${issue.code}-${issue.message}`}
            className={`rounded border px-2 py-1 text-xs ${issue.severity === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-warning/40 bg-warning/10 text-warning"}`}
          >
            {issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InspectPanel({
  scenario,
  selection,
  validation,
}: {
  scenario: Scenario;
  selection: Selection;
  validation?: ValidationState;
}) {
  const edit = useProjectStore((s) => s.edit);
  const remove = () => {
    edit(deleteSelection(scenario, selection));
  };
  let content: ReactNode = null;

  if (selection?.kind === "mission") {
    const mission = scenario.missions.find((m) => m.id === selection.id);
    if (mission) {
      const pose = mission.approach_pose;
      content = (
        <Section title={mission.name} onDelete={remove}>
          <TextField
            label="Name"
            value={mission.name}
            onCommit={(name) => {
              edit(updateMission(scenario, mission.id, { name }));
            }}
          />
          <div className={grid}>
            <NumberField
              label="Approach x"
              unit="cm"
              value={pose.x}
              min={0}
              max={scenario.arena.width}
              minExclusive={false}
              onCommit={(x) => {
                edit(updateMission(scenario, mission.id, { approach_pose: { ...pose, x } }));
              }}
            />
            <NumberField
              label="Approach y"
              unit="cm"
              value={pose.y}
              min={0}
              max={scenario.arena.height}
              minExclusive={false}
              onCommit={(y) => {
                edit(updateMission(scenario, mission.id, { approach_pose: { ...pose, y } }));
              }}
            />
            <NumberField
              label="Heading"
              unit="deg"
              value={pose.theta}
              onCommit={(theta) => {
                edit(setHeading(scenario, selection, theta));
              }}
            />
          </div>
          <p className="text-xs text-muted">
            Id <span className="font-mono">{mission.id}</span>. Durations, success rate, points and
            constraints are edited on the{" "}
            <Link to="/missions" className="text-accent underline-offset-2 hover:underline">
              Missions page
            </Link>
            .
          </p>
        </Section>
      );
    }
  } else if (selection?.kind === "obstacle") {
    const obstacle = scenario.arena.obstacles.find((o) => o.id === selection.id);
    if (obstacle) {
      const shape = obstacle.shape;
      const set = (patch: Record<string, number>) => {
        edit(updateShape(scenario, obstacle.id, patch));
      };
      content = (
        <Section title={obstacle.label} onDelete={remove}>
          <TextField
            label="Label"
            value={obstacle.label}
            onCommit={(label) => {
              edit(updateObstacle(scenario, obstacle.id, { label }));
            }}
          />
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="accent-accent"
              checked={obstacle.kind === "no_go"}
              onChange={(event) => {
                edit(
                  updateObstacle(scenario, obstacle.id, {
                    kind: event.target.checked ? "no_go" : "solid",
                  }),
                );
              }}
            />
            Keep-out area (not a physical object)
          </label>
          <div className={grid}>
            <NumberField
              label="Centre x"
              unit="cm"
              value={shape.cx}
              min={-MAX_LENGTH}
              max={2 * MAX_LENGTH}
              minExclusive={false}
              onCommit={(cx) => {
                set({ cx });
              }}
            />
            <NumberField
              label="Centre y"
              unit="cm"
              value={shape.cy}
              min={-MAX_LENGTH}
              max={2 * MAX_LENGTH}
              minExclusive={false}
              onCommit={(cy) => {
                set({ cy });
              }}
            />
            {shape.kind === "rect" ? (
              <>
                <NumberField
                  label="Width"
                  unit="cm"
                  value={shape.width}
                  min={0}
                  max={MAX_LENGTH}
                  onCommit={(width) => {
                    set({ width });
                  }}
                />
                <NumberField
                  label="Height"
                  unit="cm"
                  value={shape.height}
                  min={0}
                  max={MAX_LENGTH}
                  onCommit={(height) => {
                    set({ height });
                  }}
                />
                <NumberField
                  label="Rotation"
                  unit="deg"
                  value={shape.rotation}
                  onCommit={(rotation) => {
                    set({ rotation });
                  }}
                />
              </>
            ) : (
              <NumberField
                label="Radius"
                unit="cm"
                value={shape.radius}
                min={0}
                max={MAX_LENGTH}
                onCommit={(radius) => {
                  set({ radius });
                }}
              />
            )}
          </div>
        </Section>
      );
    }
  } else if (selection?.kind === "zone") {
    const zone = scenario.arena.home_zones.find((z) => z.id === selection.id);
    if (zone) {
      const set = (patch: Record<string, number>) => {
        edit(updateZone(scenario, zone.id, patch));
      };
      content = (
        <Section title={zone.label} onDelete={remove}>
          <div className={grid}>
            <NumberField
              label="Centre x"
              unit="cm"
              value={zone.shape.cx}
              min={0}
              max={scenario.arena.width}
              minExclusive={false}
              onCommit={(cx) => {
                set({ cx });
              }}
            />
            <NumberField
              label="Centre y"
              unit="cm"
              value={zone.shape.cy}
              min={0}
              max={scenario.arena.height}
              minExclusive={false}
              onCommit={(cy) => {
                set({ cy });
              }}
            />
            <NumberField
              label="Width"
              unit="cm"
              value={zone.shape.width}
              min={0}
              max={MAX_LENGTH}
              onCommit={(width) => {
                set({ width });
              }}
            />
            <NumberField
              label="Height"
              unit="cm"
              value={zone.shape.height}
              min={0}
              max={MAX_LENGTH}
              onCommit={(height) => {
                set({ height });
              }}
            />
          </div>
        </Section>
      );
    }
  } else if (selection?.kind === "start") {
    const pose = scenario.arena.start_pose;
    const setPose = (patch: Partial<typeof pose>) => {
      edit({ ...scenario, arena: { ...scenario.arena, start_pose: { ...pose, ...patch } } });
    };
    content = (
      <Section title="Start pose">
        <div className={grid}>
          <NumberField
            label="x"
            unit="cm"
            value={pose.x}
            min={0}
            max={scenario.arena.width}
            minExclusive={false}
            onCommit={(x) => {
              setPose({ x });
            }}
          />
          <NumberField
            label="y"
            unit="cm"
            value={pose.y}
            min={0}
            max={scenario.arena.height}
            minExclusive={false}
            onCommit={(y) => {
              setPose({ y });
            }}
          />
          <NumberField
            label="Heading"
            unit="deg"
            value={pose.theta}
            onCommit={(theta) => {
              edit(setHeading(scenario, selection, theta));
            }}
          />
        </div>
        <p className="text-xs text-muted">
          In multi-run formats the robot also returns here between runs.
        </p>
      </Section>
    );
  } else {
    const arena = scenario.arena;
    const setArena = (patch: Partial<typeof arena>) => {
      edit({ ...scenario, arena: { ...arena, ...patch } });
    };
    content = (
      <Section title="Field">
        <TextField
          label="Scenario name"
          value={scenario.name}
          onCommit={(name) => {
            edit({ ...scenario, name });
          }}
        />
        <div className={grid}>
          <NumberField
            label="Width"
            unit="cm"
            value={arena.width}
            min={0}
            max={MAX_LENGTH}
            onCommit={(width) => {
              setArena({ width });
            }}
          />
          <NumberField
            label="Height"
            unit="cm"
            value={arena.height}
            min={0}
            max={MAX_LENGTH}
            onCommit={(height) => {
              setArena({ height });
            }}
          />
          <NumberField
            label="Planning grid"
            unit="cm"
            value={arena.grid_resolution}
            min={0.002}
            max={0.25}
            minExclusive={false}
            hint="Cell size of the planning grid. Smaller is more precise but slower (see experiment 6)."
            onCommit={(grid_resolution) => {
              setArena({ grid_resolution });
            }}
          />
        </div>
        <p className="text-xs text-muted">
          Select an object to edit it, or use the toolbar to add obstacles and missions.
        </p>
      </Section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {content}
      {validation && <Issues validation={validation} />}
      <Legend />
    </div>
  );
}
