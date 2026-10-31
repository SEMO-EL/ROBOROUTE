import { Plus, Trash2, X } from "lucide-react";
import { useId, useState, type ReactNode, type SyntheticEvent } from "react";
import { Link } from "react-router";

import { NumberField, TextField } from "@/components/NumberField";
import { addMission, deleteSelection, updateMission } from "@/features/arena/editing";
import { useValidation } from "@/features/arena/useValidation";
import { api, type Scenario } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";

import { DistributionEditor } from "./DistributionEditor";
import {
  addBonus,
  addConstraint,
  countsEstimate,
  penaltyOf,
  pointsOf,
  removeConstraint,
  removeRule,
  setFormat,
  setPenalty,
  setPoints,
} from "./editing";

type ApiClient = typeof api;
type Mission = Scenario["missions"][number];
type Constraint = Scenario["constraints"][number];

const pct = (p: number) => `${(p * 100).toFixed(0)}%`;

function Card({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </header>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-text"
      >
        {children}
      </select>
    </div>
  );
}

function successLabel(mission: Mission): string {
  return mission.success.kind === "probability"
    ? pct(mission.success.p)
    : `${mission.success.successes}/${mission.success.attempts}`;
}

function MissionForm({ scenario, mission }: { scenario: Scenario; mission: Mission }) {
  const edit = useProjectStore((s) => s.edit);
  const update = (patch: Partial<Omit<Mission, "id">>) => {
    edit(updateMission(scenario, mission.id, patch));
  };
  const attachments = [
    ...new Set(scenario.missions.map((m) => m.attachment).filter((a): a is string => Boolean(a))),
  ];
  const success = mission.success;

  return (
    <Card
      title={mission.name}
      aside={
        <button
          type="button"
          onClick={() => {
            edit(deleteSelection(scenario, { kind: "mission", id: mission.id }));
          }}
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 aria-hidden="true" className="size-3.5" /> Delete mission
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Name"
          value={mission.name}
          onCommit={(name) => {
            update({ name });
          }}
        />
        <NumberField
          label="Points"
          unit="pts"
          value={pointsOf(scenario, mission.id)}
          min={0}
          max={100_000}
          minExclusive={false}
          onCommit={(points) => {
            edit(setPoints(scenario, mission.id, points));
          }}
        />
      </div>
      <TextField
        label="Description"
        value={mission.description}
        maxLength={2000}
        allowEmpty
        onCommit={(description) => {
          update({ description });
        }}
      />
      <DistributionEditor
        label="Time to do the mission (from the approach pose)"
        value={mission.execution_time}
        onChange={(execution_time) => {
          update({ execution_time });
        }}
      />

      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs text-muted">How often it succeeds (per attempt)</legend>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              className="accent-accent"
              checked={success.kind === "probability"}
              onChange={() => {
                const p =
                  success.kind === "counts"
                    ? countsEstimate(success.successes, success.attempts)
                    : 0.9;
                update({ success: { kind: "probability", p: Number(p.toFixed(3)) } });
              }}
            />
            Estimated chance
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              className="accent-accent"
              checked={success.kind === "counts"}
              onChange={() => {
                update({ success: { kind: "counts", successes: 8, attempts: 10 } });
              }}
            />
            Practice results
          </label>
        </div>
        {success.kind === "probability" ? (
          <NumberField
            label="Chance of success"
            unit="%"
            value={success.p}
            min={0}
            max={1}
            minExclusive={false}
            onCommit={(p) => {
              update({ success: { kind: "probability", p } });
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Successes"
                unit=""
                integer
                value={success.successes}
                min={0}
                max={success.attempts}
                minExclusive={false}
                onCommit={(successes) => {
                  update({ success: { ...success, successes } });
                }}
              />
              <NumberField
                label="Attempts"
                unit=""
                integer
                value={success.attempts}
                min={Math.max(1, success.successes)}
                max={100_000}
                minExclusive={false}
                onCommit={(attempts) => {
                  update({ success: { ...success, attempts } });
                }}
              />
            </div>
            <p className="text-xs text-muted">
              RoboRoute uses (successes + 1) / (attempts + 2) ={" "}
              {pct(countsEstimate(success.successes, success.attempts))}: a few practice runs never
              prove a mission is certain. More practice runs make the estimate more reliable.
            </p>
          </>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Attempts allowed"
          unit=""
          integer
          value={mission.max_attempts}
          min={1}
          max={10}
          minExclusive={false}
          onCommit={(max_attempts) => {
            update({ max_attempts });
          }}
        />
        <NumberField
          label="Penalty if it fails"
          unit="pts"
          value={penaltyOf(scenario, mission.id)}
          min={0}
          max={100_000}
          minExclusive={false}
          onCommit={(points) => {
            edit(setPenalty(scenario, mission.id, points));
          }}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor={`attachment-${mission.id}`} className="text-xs text-muted">
            Attachment needed
          </label>
          <input
            id={`attachment-${mission.id}`}
            list={`attachments-${mission.id}`}
            defaultValue={mission.attachment ?? ""}
            key={mission.attachment ?? ""}
            placeholder="none"
            maxLength={120}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if ((value || null) !== mission.attachment) update({ attachment: value || null });
            }}
            className="rounded-md border border-border bg-surface-2 px-2 py-1 text-text"
          />
          <datalist id={`attachments-${mission.id}`}>
            {attachments.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
      </div>
      <p className="text-xs text-muted">
        Position and heading are set on the{" "}
        <Link
          to="/arena"
          className="text-accent underline underline-offset-2 hover:text-accent-strong"
        >
          Arena page
        </Link>
        .
      </p>
    </Card>
  );
}

const RELATIONS = [
  { value: "requires", label: "must succeed before" },
  { value: "requires_attempted", label: "must be attempted before" },
  { value: "precedes", label: "comes before (if both are done)" },
  { value: "excludes", label: "cannot be combined with" },
] as const;

function describeConstraint(c: Constraint, names: Record<string, string>): string {
  const n = (id: string) => names[id] ?? id;
  if (c.kind === "excludes") return `${n(c.a)} cannot be combined with ${n(c.b)}`;
  if (c.kind === "precedes") return `${n(c.before)} comes before ${n(c.after)} (if both are done)`;
  return c.semantics === "succeeded"
    ? `${n(c.after)} requires ${n(c.before)} to succeed first`
    : `${n(c.after)} requires ${n(c.before)} to be attempted first`;
}

function Constraints({ scenario }: { scenario: Scenario }) {
  const edit = useProjectStore((s) => s.edit);
  const names = Object.fromEntries(scenario.missions.map((m) => [m.id, m.name]));
  const first = scenario.missions[0]?.id ?? "";
  const [a, setA] = useState(first);
  const [relation, setRelation] = useState<(typeof RELATIONS)[number]["value"]>("requires");
  const [b, setB] = useState(scenario.missions[1]?.id ?? first);

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!a || !b || a === b) return;
    const constraint: Constraint =
      relation === "excludes"
        ? { kind: "excludes", a, b }
        : relation === "precedes"
          ? { kind: "precedes", before: a, after: b }
          : {
              kind: "requires",
              before: a,
              after: b,
              semantics: relation === "requires" ? "succeeded" : "attempted",
            };
    edit(addConstraint(scenario, constraint));
  }

  return (
    <Card title="Constraints between missions">
      {scenario.constraints.length === 0 ? (
        <p className="text-muted">
          No constraints: missions can be done in any order and combination.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {scenario.constraints.map((c, index) => (
            <li key={JSON.stringify(c)} className="flex items-center justify-between gap-2 py-1.5">
              <span>{describeConstraint(c, names)}</span>
              <button
                type="button"
                aria-label={`Remove: ${describeConstraint(c, names)}`}
                onClick={() => {
                  edit(removeConstraint(scenario, index));
                }}
                className="cursor-pointer rounded p-1 text-muted hover:text-danger"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {scenario.missions.length >= 2 && (
        <form
          aria-label="Add constraint"
          onSubmit={submit}
          className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <SelectField label="First mission" value={a} onChange={setA}>
            {scenario.missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Relation"
            value={relation}
            onChange={(v) => {
              setRelation(v as typeof relation);
            }}
          >
            {RELATIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Second mission" value={b} onChange={setB}>
            {scenario.missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>
          <button
            type="submit"
            disabled={a === b}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 hover:bg-surface-2 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
    </Card>
  );
}

function Bonuses({ scenario }: { scenario: Scenario }) {
  const edit = useProjectStore((s) => s.edit);
  const names = Object.fromEntries(scenario.missions.map((m) => [m.id, m.name]));
  const [chosen, setChosen] = useState<string[]>([]);
  const [points, setPointsDraft] = useState(10);
  return (
    <Card title="Bonuses">
      {scenario.scoring.rules.every((r) => r.kind !== "all_of_bonus") && (
        <p className="text-muted">No bonuses.</p>
      )}
      <ul className="flex flex-col gap-1">
        {scenario.scoring.rules.map((rule, index) =>
          rule.kind === "all_of_bonus" ? (
            <li
              key={`${rule.missions.join("+")}-${rule.points}`}
              className="flex items-center justify-between gap-2"
            >
              <span>
                +{rule.points} pts if all succeed:{" "}
                {rule.missions.map((m) => names[m] ?? m).join(", ")}
              </span>
              <button
                type="button"
                aria-label="Remove bonus"
                onClick={() => {
                  edit(removeRule(scenario, index));
                }}
                className="cursor-pointer rounded p-1 text-muted hover:text-danger"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ) : null,
        )}
      </ul>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-muted">New bonus: choose two or more missions</legend>
        <div className="flex flex-wrap gap-3">
          {scenario.missions.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-accent"
                checked={chosen.includes(m.id)}
                onChange={() => {
                  setChosen((c) => (c.includes(m.id) ? c.filter((x) => x !== m.id) : [...c, m.id]));
                }}
              />
              {m.name}
            </label>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <NumberField
            label="Bonus"
            unit="pts"
            value={points}
            min={0}
            max={100_000}
            onCommit={setPointsDraft}
          />
          <button
            type="button"
            disabled={chosen.length < 2}
            onClick={() => {
              edit(addBonus(scenario, chosen, points));
              setChosen([]);
            }}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 hover:bg-surface-2 disabled:opacity-50"
          >
            Add bonus
          </button>
        </div>
      </fieldset>
    </Card>
  );
}

function MatchRules({ scenario }: { scenario: Scenario }) {
  const edit = useProjectStore((s) => s.edit);
  const format = scenario.format;
  return (
    <Card title="Match rules">
      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="radio"
            className="accent-accent"
            checked={format.kind === "single_run"}
            onChange={() => {
              edit(setFormat(scenario, { kind: "single_run" }));
            }}
          />
          One continuous run (WRO-style)
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="radio"
            className="accent-accent"
            checked={format.kind === "multi_run"}
            onChange={() => {
              edit(setFormat(scenario, { kind: "multi_run" }));
            }}
          />
          Several runs from home (FLL-style)
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Time budget"
          unit="s"
          value={format.time_budget}
          min={0}
          max={600}
          onCommit={(time_budget) => {
            edit(setFormat(scenario, { time_budget }));
          }}
        />
        {format.kind === "multi_run" && (
          <NumberField
            label="Time in home between runs"
            unit="s"
            value={format.reset_time}
            min={0}
            max={120}
            minExclusive={false}
            hint="Handling time per return: catching the robot, changing the attachment, relaunching"
            onCommit={(reset_time) => {
              edit(setFormat(scenario, { reset_time }));
            }}
          />
        )}
        <label className="flex cursor-pointer items-end gap-2 pb-1.5">
          <input
            type="checkbox"
            className="accent-accent"
            checked={format.must_end_in_home}
            onChange={(e) => {
              edit(setFormat(scenario, { must_end_in_home: e.target.checked }));
            }}
          />
          Robot must end in home
        </label>
      </div>
      <p className="text-xs text-muted">
        Check the rules of your competition season — RoboRoute does not assume any official rules.
      </p>
    </Card>
  );
}

export function MissionsPage({ client = api }: { client?: ApiClient }) {
  const scenario = useProjectStore((s) => s.scenario);
  const edit = useProjectStore((s) => s.edit);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const validation = useValidation(scenario, client);

  if (!scenario) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">No scenario loaded</h1>
        <Link
          to="/"
          className="rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent hover:bg-accent-strong"
        >
          Choose a scenario
        </Link>
      </div>
    );
  }

  const selected =
    scenario.missions.find((m) => m.id === selectedId) ?? scenario.missions[0] ?? null;
  const issues = validation.kind === "done" ? validation.issues : [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-lg font-semibold">Missions</h1>
        <p className="text-muted">
          Points, durations, reliability and the rules that connect missions.
        </p>
      </header>
      {issues.length > 0 && (
        <ul aria-label="Problems" className="flex flex-col gap-1.5">
          {issues.map((issue) => (
            <li
              key={`${issue.code}-${issue.message}`}
              className={`rounded border px-3 py-1.5 text-sm ${issue.severity === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-warning/40 bg-warning/10 text-warning"}`}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="Mission list" className="flex flex-col gap-1">
          {scenario.missions.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-current={selected?.id === m.id ? "true" : undefined}
              onClick={() => {
                setSelectedId(m.id);
              }}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-transparent px-3 py-2 text-left hover:bg-surface aria-[current]:border-border aria-[current]:bg-surface"
            >
              <span className="truncate">{m.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {pointsOf(scenario, m.id)} pts · {successLabel(m)}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const { scenario: next, id } = addMission(scenario, {
                x: scenario.arena.width / 2,
                y: scenario.arena.height / 2,
              });
              edit(next);
              setSelectedId(id);
            }}
            className="mt-1 flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-muted hover:bg-surface hover:text-text"
          >
            <Plus aria-hidden="true" className="size-4" /> Add mission
          </button>
        </nav>
        <div className="flex flex-col gap-4">
          {selected ? (
            <MissionForm key={selected.id} scenario={scenario} mission={selected} />
          ) : (
            <p className="text-muted">No missions yet.</p>
          )}
          <Constraints scenario={scenario} />
          <Bonuses scenario={scenario} />
          <MatchRules scenario={scenario} />
        </div>
      </div>
    </div>
  );
}
