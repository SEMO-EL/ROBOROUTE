import { X } from "lucide-react";
import { useId, useState, type SyntheticEvent } from "react";

import type { Scenario } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";

import { removeTripTime, setTripTime } from "./robot";

const MAX_SECONDS = 600; // the scenario schema's Duration bound

const selectClass = "rounded-md border border-border bg-surface-2 px-2 py-1.5 text-text";

/**
 * Stopwatch times for whole trips (for example home → crane). They replace the modelled travel
 * time for that trip in every plan and simulation, and are labelled "measured" in the timeline.
 */
export function TripTimes({ scenario }: { scenario: Scenario }) {
  const edit = useProjectStore((s) => s.edit);
  const nodes = [
    { id: "start", name: "Start" },
    ...scenario.missions.map((m) => ({ id: m.id, name: m.name })),
  ];
  const names = Object.fromEntries(nodes.map((n) => [n.id, n.name]));
  const [from, setFrom] = useState("start");
  const [to, setTo] = useState(scenario.missions[0]?.id ?? "start");
  const [seconds, setSeconds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ids = { from: useId(), to: useId(), seconds: useId() };

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(seconds);
    if (seconds.trim() === "" || !Number.isFinite(value) || value <= 0 || value > MAX_SECONDS) {
      setError(`Enter a positive time of at most ${String(MAX_SECONDS)} s.`);
      return;
    }
    if (from === to) {
      setError("Choose two different places.");
      return;
    }
    setError(null);
    edit(setTripTime(scenario, from, to, value));
    setSeconds("");
  }

  if (scenario.missions.length === 0) {
    return <p className="text-sm text-muted">Add missions first; trips run between them.</p>;
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted">
        Timed a whole trip with your real robot? Enter it here and it is used instead of the
        modelled time, in that direction only.
      </p>
      {scenario.travel_overrides.length > 0 && (
        <ul aria-label="Measured trips" className="flex flex-col divide-y divide-border">
          {scenario.travel_overrides.map((o, index) => {
            const label = `${names[o.from_node] ?? o.from_node} → ${names[o.to_node] ?? o.to_node}`;
            return (
              <li
                key={`${o.from_node}|${o.to_node}`}
                className="flex items-center justify-between gap-2 py-1.5"
              >
                <span>{label}</span>
                <span className="ml-auto font-mono">{o.seconds} s</span>
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  onClick={() => {
                    edit(removeTripTime(scenario, index));
                  }}
                  className="cursor-pointer rounded p-1 text-muted hover:text-danger"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        aria-label="Add a measured trip"
        onSubmit={submit}
        className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.from} className="text-xs text-muted">
            From
          </label>
          <select
            id={ids.from}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
            }}
            className={selectClass}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.to} className="text-xs text-muted">
            To
          </label>
          <select
            id={ids.to}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
            }}
            className={selectClass}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.seconds} className="text-xs text-muted">
            Seconds
          </label>
          <input
            id={ids.seconds}
            inputMode="decimal"
            value={seconds}
            onChange={(e) => {
              setSeconds(e.target.value);
            }}
            aria-invalid={error !== null}
            className={`${selectClass} font-mono`}
          />
        </div>
        <button
          type="submit"
          className="cursor-pointer rounded-md border border-border px-3 py-1.5 hover:bg-surface-2"
        >
          Add
        </button>
        {error && (
          <p role="alert" className="text-danger sm:col-span-4">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
