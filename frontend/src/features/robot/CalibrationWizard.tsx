import { Plus, X } from "lucide-react";
import { useState } from "react";

import { ErrorAlert } from "@/components/Alert";
import { api } from "@/lib/api/client";
import { fitCalibration, type CalibrationFit } from "@/lib/api/endpoints";

type ApiClient = typeof api;
type Kind = "linear" | "angular";

interface Row {
  amount: string;
  seconds: string;
}

const COPY: Record<
  Kind,
  {
    amountLabel: string;
    unit: string;
    toSi: number;
    speedUnit: string;
    accelUnit: string;
    button: string;
    how: string;
  }
> = {
  linear: {
    amountLabel: "Distance",
    unit: "cm",
    toSi: 0.01,
    speedUnit: "cm/s",
    accelUnit: "cm/s²",
    button: "Fit driving speed",
    how: "Run your usual drive-straight command over a measured distance and time it from start to stop (a phone stopwatch is fine). Use at least two different distances — for example 20 cm and 100 cm — and repeat each a few times.",
  },
  angular: {
    amountLabel: "Angle",
    unit: "°",
    toSi: Math.PI / 180,
    speedUnit: "°/s",
    accelUnit: "°/s²",
    button: "Fit turning speed",
    how: "Run your usual turn-on-the-spot command for a known angle and time it. Use at least two different angles — for example 90° and 360°.",
  },
};

/**
 * Turn stopwatch measurements into speed and acceleration. The fit itself runs in the engine
 * (least squares on t = d/v + v/a); this component only collects data and shows the result.
 */
export function CalibrationWizard({
  kind,
  client = api,
  onApply,
}: {
  kind: Kind;
  client?: ApiClient;
  onApply: (fit: CalibrationFit) => void;
}) {
  const copy = COPY[kind];
  const [rows, setRows] = useState<Row[]>([
    { amount: "", seconds: "" },
    { amount: "", seconds: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [fit, setFit] = useState<CalibrationFit | null>(null);
  const [pending, setPending] = useState(false);
  const fromSi = 1 / copy.toSi;

  function setRow(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setFit(null);
  }

  async function run() {
    const measurements: { amount: number; seconds: number }[] = [];
    for (const [index, row] of rows.entries()) {
      if (!row.amount.trim() && !row.seconds.trim()) continue;
      const amount = Number(row.amount.replace(",", "."));
      const seconds = Number(row.seconds.replace(",", "."));
      if (
        !(amount > 0) ||
        !(seconds > 0) ||
        !Number.isFinite(amount) ||
        !Number.isFinite(seconds)
      ) {
        setError(
          `Row ${index + 1}: enter a positive ${copy.amountLabel.toLowerCase()} and a positive time.`,
        );
        return;
      }
      measurements.push({ amount: Number((amount * copy.toSi).toFixed(9)), seconds });
    }
    if (measurements.length === 0) {
      setError("Enter at least one measurement.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      setFit(await fitCalibration(client, { kind, measurements }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{copy.how}</p>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1 font-medium">#</th>
            <th className="py-1 font-medium">
              {copy.amountLabel} ({copy.unit})
            </th>
            <th className="py-1 font-medium">Time (s)</th>
            {fit && <th className="py-1 font-medium">Model error (s)</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // Rows have no identity beyond their position in this small, local list.
            <tr key={index} className="border-t border-border">
              <td className="py-1 pr-2 text-muted">{index + 1}</td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`${copy.amountLabel} ${index + 1} (${copy.unit})`}
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) => {
                    setRow(index, { amount: e.target.value });
                  }}
                  className="w-24 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono"
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`Time ${index + 1} (s)`}
                  inputMode="decimal"
                  value={row.seconds}
                  onChange={(e) => {
                    setRow(index, { seconds: e.target.value });
                  }}
                  className="w-24 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono"
                />
              </td>
              {fit && (
                <td className="py-1 pr-2 font-mono text-xs text-muted">
                  {fit.residuals[index] !== undefined ? fit.residuals[index].toFixed(2) : ""}
                </td>
              )}
              <td>
                {rows.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove row ${index + 1}`}
                    onClick={() => {
                      setRows((r) => r.filter((_, i) => i !== index));
                      setFit(null);
                    }}
                    className="cursor-pointer rounded p-1 text-muted hover:text-danger"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setRows((r) => [...r, { amount: "", seconds: "" }]);
          }}
          className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface-2"
        >
          <Plus aria-hidden="true" className="size-4" /> Add measurement
        </button>
        <button
          type="button"
          onClick={() => void run()}
          disabled={pending}
          className="cursor-pointer rounded-md bg-accent px-3 py-1 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-60"
        >
          {copy.button}
        </button>
      </div>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      {fit && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2/50 p-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            <dt className="text-xs text-muted">Top speed</dt>
            <dd className="font-mono">{`${(fit.max_speed * fromSi).toFixed(1)} ${copy.speedUnit}`}</dd>
            <dt className="text-xs text-muted">Acceleration</dt>
            <dd className="font-mono">
              {fit.acceleration === null
                ? "not measurable"
                : `${(fit.acceleration * fromSi).toFixed(1)} ${copy.accelUnit}`}
            </dd>
            <dt className="text-xs text-muted">Model</dt>
            <dd>
              {fit.model === "trapezoidal" ? "speeds up, cruises, slows down" : "constant speed"}
            </dd>
            <dt className="text-xs text-muted">Fit quality R²</dt>
            <dd className="font-mono">{fit.r_squared === null ? "—" : fit.r_squared.toFixed(3)}</dd>
          </dl>
          {fit.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning"
            >
              {warning}
            </p>
          ))}
          <div>
            <button
              type="button"
              onClick={() => {
                onApply(fit);
              }}
              className="cursor-pointer rounded-md bg-accent px-3 py-1 text-sm font-medium text-on-accent hover:bg-accent-strong"
            >
              Apply to robot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
