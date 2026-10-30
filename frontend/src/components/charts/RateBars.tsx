import { ChartFrame, tableClass } from "./ChartFrame";

export interface RateRow {
  label: string;
  estimate: number;
  low: number;
  high: number;
  /** Context shown under the label, e.g. how often the mission was reached at all. */
  note?: string;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Proportions (0–100 %) as horizontal bars with their 95 % interval as a whisker. */
export function RateBars({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: readonly RateRow[];
}) {
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Mission</th>
              <th>Estimate</th>
              <th>95% interval</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{pct(row.estimate)}</td>
                <td>
                  {pct(row.low)}–{pct(row.high)}
                </td>
                <td>{row.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.label}
            className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate" title={row.label}>
                {row.label}
              </span>
              {row.note && <span className="text-xs text-muted">{row.note}</span>}
            </span>
            <div
              className="relative h-3 rounded-sm bg-surface-2"
              title={`95% interval ${pct(row.low)}–${pct(row.high)}`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-r bg-series-1/80"
                style={{ width: `${row.estimate * 100}%` }}
              />
              <div
                className="absolute top-1/2 h-px bg-text"
                style={{ left: `${row.low * 100}%`, width: `${(row.high - row.low) * 100}%` }}
              />
              <div
                className="absolute top-0 h-3 w-px bg-text"
                style={{ left: `${row.low * 100}%` }}
              />
              <div
                className="absolute top-0 h-3 w-px bg-text"
                style={{ left: `${row.high * 100}%` }}
              />
            </div>
            <span className="text-right font-mono text-xs">{pct(row.estimate)}</span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
