import { useId, useState } from "react";

/**
 * Display units for numeric fields. Values are stored in SI (m, rad, s, probability 0–1) and only
 * converted here, at the presentation boundary.
 */
export type Unit = "cm" | "deg" | "s" | "cm/s" | "deg/s" | "cm/s²" | "deg/s²" | "%" | "pts" | "";

const UNIT: Record<Unit, { label: string; scale: number }> = {
  cm: { label: "cm", scale: 100 },
  deg: { label: "°", scale: 180 / Math.PI },
  s: { label: "s", scale: 1 },
  "cm/s": { label: "cm/s", scale: 100 },
  "deg/s": { label: "°/s", scale: 180 / Math.PI },
  "cm/s²": { label: "cm/s²", scale: 100 },
  "deg/s²": { label: "°/s²", scale: 180 / Math.PI },
  "%": { label: "%", scale: 100 },
  pts: { label: "pts", scale: 1 },
  "": { label: "", scale: 1 },
};

function display(value: number, unit: Unit): string {
  return Number((value * UNIT[unit].scale).toFixed(3)).toString();
}

interface NumberFieldProps {
  label: string;
  /** Current value in SI units. */
  value: number;
  unit: Unit;
  /** Bounds in SI units; `min` is exclusive when `minExclusive` (e.g. sizes must be > 0). */
  min?: number;
  max?: number;
  minExclusive?: boolean;
  integer?: boolean;
  hint?: string;
  onCommit: (value: number) => void;
}

/**
 * A numeric input that edits a draft and commits on Enter or blur — one undo step per change —
 * and only when the text parses to a finite number within bounds. Invalid input shows an error and
 * leaves the stored value untouched.
 */
export function NumberField({
  label,
  value,
  unit,
  min,
  max,
  minExclusive = true,
  integer = false,
  hint,
  onCommit,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(display(value, unit));
  const [shown, setShown] = useState(value);
  const [error, setError] = useState<string | null>(null);
  if (value !== shown) {
    // The stored value changed elsewhere (drag, undo): show it.
    setShown(value);
    setDraft(display(value, unit));
    setError(null);
  }
  const unitLabel = UNIT[unit].label;

  function commit() {
    const text = draft.trim().replace(",", ".");
    const parsed = text === "" ? Number.NaN : Number(text) / UNIT[unit].scale;
    let problem: string | null = null;
    if (!Number.isFinite(parsed)) problem = "Enter a number.";
    else if (integer && !Number.isInteger(parsed)) problem = "Enter a whole number.";
    else if (min !== undefined && (minExclusive ? parsed <= min : parsed < min)) {
      problem = `Must be ${minExclusive ? "more than" : "at least"} ${display(min, unit)}${unitLabel ? ` ${unitLabel}` : ""}.`;
    } else if (max !== undefined && parsed > max) {
      problem = `Must be at most ${display(max, unit)}${unitLabel ? ` ${unitLabel}` : ""}.`;
    }
    setError(problem);
    if (problem) return;
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <div className="flex flex-col gap-1" title={hint}>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
        {unitLabel && ` (${unitLabel})`}
      </label>
      <input
        id={id}
        inputMode="decimal"
        value={draft}
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setDraft(display(value, unit));
            setError(null);
          }
        }}
        className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-text aria-invalid:border-danger"
      />
      {error && (
        <span id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  value,
  maxLength = 120,
  onCommit,
}: {
  label: string;
  value: string;
  maxLength?: number;
  onCommit: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setDraft(value);
  }
  const commit = () => {
    const text = draft.trim();
    if (text && text !== value) onCommit(text.slice(0, maxLength));
    else setDraft(value);
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        value={draft}
        maxLength={maxLength}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        className="rounded-md border border-border bg-surface-2 px-2 py-1 text-text"
      />
    </div>
  );
}
