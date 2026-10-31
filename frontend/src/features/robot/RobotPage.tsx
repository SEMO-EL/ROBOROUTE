import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { NumberField, TextField } from "@/components/NumberField";
import { api, type Scenario } from "@/lib/api/client";
import { footprintRadius } from "@/lib/robot/footprint";
import { useProjectStore } from "@/stores/project";

import { CalibrationWizard } from "./CalibrationWizard";
import { applyCalibration, MOTORS, speedCeiling, updateProfile, updateRobot } from "./robot";

type ApiClient = typeof api;
type Profile = Scenario["robot"]["linear"];

const PROVENANCE: Record<Profile["provenance"], { label: string; className: string }> = {
  calibrated: {
    label: "calibrated from your measurements",
    className: "border-success/40 text-success",
  },
  entered: { label: "entered by hand", className: "border-border-strong text-muted" },
  reference: { label: "manufacturer reference", className: "border-warning/40 text-warning" },
};

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
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </header>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

function Provenance({ profile }: { profile: Profile }) {
  const p = PROVENANCE[profile.provenance];
  return <span className={`rounded border px-1.5 py-0.5 text-xs ${p.className}`}>{p.label}</span>;
}

function Ceiling({ speed }: { speed: number }) {
  const id = useId();
  const [motorId, setMotorId] = useState(MOTORS[0]?.id ?? "");
  const [wheel, setWheel] = useState(0.056);
  const motor = MOTORS.find((m) => m.id === motorId) ?? MOTORS[0];
  if (!motor) return null;
  const ceiling = speedCeiling(motor.noLoadRpm, wheel);
  const share = speed / ceiling;
  return (
    <Card title="Sanity check against the motor's top speed">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-xs text-muted">
            Drive motor
          </label>
          <select
            id={id}
            value={motorId}
            onChange={(e) => {
              setMotorId(e.target.value);
            }}
            className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-text"
          >
            {MOTORS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <NumberField
          label="Wheel diameter"
          unit="cm"
          value={wheel}
          min={0.005}
          max={0.5}
          onCommit={setWheel}
        />
      </div>
      <p className="text-sm">
        Upper bound: <span className="font-mono">{(ceiling * 100).toFixed(1)} cm/s</span> (
        {motor.noLoadRpm} RPM × π × wheel diameter). Your robot's top speed is{" "}
        <span className="font-mono">{(share * 100).toFixed(0)}%</span> of it.
      </p>
      {share > 1 && (
        <p
          role="alert"
          className="rounded border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger"
        >
          The robot's speed is above what the motor can reach without load — check the measurements
          or the wheel size.
        </p>
      )}
      <p className="text-xs text-muted">
        Source: {motor.source}. This is a ceiling, not a prediction: load, battery level, power
        setting and your program's acceleration make real robots slower. RoboRoute plans with your
        calibrated or entered values.
      </p>
    </Card>
  );
}

export function RobotPage({ client = api }: { client?: ApiClient }) {
  const scenario = useProjectStore((s) => s.scenario);
  const edit = useProjectStore((s) => s.edit);
  const [tab, setTab] = useState<"linear" | "angular">("linear");

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
  const robot = scenario.robot;
  const set = (patch: Parameters<typeof updateRobot>[1]) => {
    edit(updateRobot(scenario, patch));
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-lg font-semibold">Robot</h1>
        <p className="text-muted">
          Size and speed of your robot. Measure it — your measurements beat any datasheet.
        </p>
      </header>

      <Card title="Size">
        <div className="grid gap-3 sm:grid-cols-4">
          <TextField
            label="Name"
            value={robot.name}
            onCommit={(name) => {
              set({ name });
            }}
          />
          <NumberField
            label="Length"
            unit="cm"
            value={robot.length}
            min={0}
            max={20}
            onCommit={(length) => {
              set({ length });
            }}
          />
          <NumberField
            label="Width"
            unit="cm"
            value={robot.width}
            min={0}
            max={20}
            onCommit={(width) => {
              set({ width });
            }}
          />
          <NumberField
            label="Safety margin"
            unit="cm"
            value={robot.safety_margin}
            min={0}
            max={20}
            minExclusive={false}
            hint="Extra distance kept from obstacles to absorb small position errors"
            onCommit={(safety_margin) => {
              set({ safety_margin });
            }}
          />
        </div>
        <p className="text-xs text-muted">
          Collision radius {(footprintRadius(robot) * 100).toFixed(1)} cm: half the diagonal plus
          the margin. The planner keeps the robot's centre at least this far from obstacles, so it
          can turn on the spot anywhere.
        </p>
      </Card>

      <Card
        title="Speed"
        aside={
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-accent"
              checked={robot.can_reverse}
              onChange={(e) => {
                set({ can_reverse: e.target.checked });
              }}
            />
            Can drive backwards
          </label>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Driving</h3>
              <Provenance profile={robot.linear} />
            </div>
            <NumberField
              label="Top speed"
              unit="cm/s"
              value={robot.linear.max_speed}
              min={0}
              max={50}
              onCommit={(max_speed) => {
                edit(updateProfile(scenario, "linear", { max_speed }));
              }}
            />
            <NumberField
              label="Acceleration"
              unit="cm/s²"
              value={robot.linear.acceleration ?? 0}
              min={0}
              max={500}
              minExclusive={false}
              hint="0 = unknown: constant speed is assumed"
              onCommit={(a) => {
                edit(updateProfile(scenario, "linear", { acceleration: a > 0 ? a : null }));
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Turning on the spot</h3>
              <Provenance profile={robot.angular} />
            </div>
            <NumberField
              label="Turn speed"
              unit="deg/s"
              value={robot.angular.max_speed}
              min={0}
              max={50}
              onCommit={(max_speed) => {
                edit(updateProfile(scenario, "angular", { max_speed }));
              }}
            />
            <NumberField
              label="Turn acceleration"
              unit="deg/s²"
              value={robot.angular.acceleration ?? 0}
              min={0}
              max={500}
              minExclusive={false}
              hint="0 = unknown: constant turn speed is assumed"
              onCommit={(a) => {
                edit(updateProfile(scenario, "angular", { acceleration: a > 0 ? a : null }));
              }}
            />
          </div>
        </div>
      </Card>

      <Card
        title="Calibrate from your own measurements"
        aside={
          <div role="tablist" aria-label="Calibration" className="flex gap-1">
            {(["linear", "angular"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => {
                  setTab(value);
                }}
                className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-sm aria-selected:border-accent aria-selected:text-accent"
              >
                {value === "linear" ? "Driving" : "Turning"}
              </button>
            ))}
          </div>
        }
      >
        <CalibrationWizard
          key={tab}
          kind={tab}
          client={client}
          onApply={(fit) => {
            const current = useProjectStore.getState().scenario;
            if (current) edit(applyCalibration(current, tab, fit));
          }}
        />
      </Card>

      <Ceiling speed={robot.linear.max_speed} />
    </div>
  );
}
