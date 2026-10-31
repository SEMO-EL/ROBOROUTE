import { useId, useState } from "react";

import { NumberField } from "@/components/NumberField";
import { distributionMean as mean, type Distribution } from "@/lib/scenario/distributions";

const KINDS: { value: Distribution["kind"]; label: string }[] = [
  { value: "fixed", label: "Always the same" },
  { value: "triangular", label: "Best / usual / worst" },
  { value: "lognormal", label: "Typical time and spread" },
  { value: "empirical", label: "My measured times" },
];

function convert(d: Distribution, kind: Distribution["kind"]): Distribution {
  const m = Number(mean(d).toFixed(1));
  switch (kind) {
    case "fixed":
      return { kind, value: m };
    case "triangular":
      return {
        kind,
        low: Number((m * 0.8).toFixed(1)),
        mode: m,
        high: Number((m * 1.3).toFixed(1)),
      };
    case "lognormal":
      return { kind, median: Math.max(0.1, m), gsd: 1.2 };
    case "empirical":
      return { kind, samples: [m] };
  }
}

/** Edit a duration distribution in seconds; every change is a complete, valid distribution. */
export function DistributionEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Distribution;
  onChange: (d: Distribution) => void;
}) {
  const id = useId();
  const [samplesText, setSamplesText] = useState(
    value.kind === "empirical" ? value.samples.join(", ") : "",
  );
  const [samplesError, setSamplesError] = useState<string | null>(null);

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-xs text-muted">{label}</legend>
      <label htmlFor={id} className="sr-only">
        {label}: how to describe it
      </label>
      <select
        id={id}
        value={value.kind}
        onChange={(event) => {
          const next = convert(value, event.target.value as Distribution["kind"]);
          if (next.kind === "empirical") setSamplesText(next.samples.join(", "));
          onChange(next);
        }}
        className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-text"
      >
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      {value.kind === "fixed" && (
        <NumberField
          label="Duration"
          unit="s"
          value={value.value}
          min={0}
          max={600}
          minExclusive={false}
          onCommit={(v) => {
            onChange({ ...value, value: v });
          }}
        />
      )}
      {value.kind === "triangular" && (
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="Best"
            unit="s"
            value={value.low}
            min={0}
            max={value.mode}
            minExclusive={false}
            onCommit={(low) => {
              onChange({ ...value, low });
            }}
          />
          <NumberField
            label="Usual"
            unit="s"
            value={value.mode}
            min={value.low}
            max={value.high}
            minExclusive={false}
            onCommit={(mode) => {
              onChange({ ...value, mode });
            }}
          />
          <NumberField
            label="Worst"
            unit="s"
            value={value.high}
            min={value.mode}
            max={600}
            minExclusive={false}
            onCommit={(high) => {
              onChange({ ...value, high });
            }}
          />
        </div>
      )}
      {value.kind === "lognormal" && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Typical (median)"
            unit="s"
            value={value.median}
            min={0}
            max={600}
            onCommit={(median) => {
              onChange({ ...value, median });
            }}
          />
          <NumberField
            label="Spread factor"
            unit=""
            value={value.gsd}
            min={1}
            max={10}
            minExclusive={false}
            hint="1 = no variation; 1.2 means about two thirds of runs fall within ÷1.2 to ×1.2 of the typical time"
            onCommit={(gsd) => {
              onChange({ ...value, gsd });
            }}
          />
        </div>
      )}
      {value.kind === "empirical" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-samples`} className="text-xs text-muted">
            Measured times (s), separated by commas
          </label>
          <textarea
            id={`${id}-samples`}
            rows={2}
            value={samplesText}
            onChange={(event) => {
              setSamplesText(event.target.value);
            }}
            onBlur={() => {
              const samples = samplesText
                .split(/[\s,;]+/)
                .filter(Boolean)
                .map(Number);
              if (
                samples.length === 0 ||
                samples.some((s) => !Number.isFinite(s) || s < 0 || s > 600)
              ) {
                setSamplesError("Enter one or more times between 0 and 600 s.");
                return;
              }
              setSamplesError(null);
              onChange({ kind: "empirical", samples: samples.slice(0, 10_000) });
            }}
            className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-text"
          />
          {samplesError && (
            <span role="alert" className="text-xs text-danger">
              {samplesError}
            </span>
          )}
        </div>
      )}
      <span className="text-xs text-muted">Average: {mean(value).toFixed(1)} s</span>
    </fieldset>
  );
}
