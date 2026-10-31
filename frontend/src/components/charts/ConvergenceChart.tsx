import { useRef, useState } from "react";

import { useElementSize } from "@/hooks/useElementSize";

import { ChartFrame, tableClass } from "./ChartFrame";
import { linearScale, niceTicks } from "./scale";

const MARGIN = { top: 16, right: 20, bottom: 34, left: 48 };

export interface ConvergencePoint {
  trials: number;
  mean: number;
  interval: { low: number; high: number };
}

const one = (value: number) => value.toFixed(1);

/**
 * Running mean of a Monte Carlo estimate with its 95 % interval, against the number of trials on
 * a logarithmic axis. One series, so the title names it and no legend is drawn; the optional
 * reference line (the planning model's value) is labelled directly.
 */
export function ConvergenceChart({
  title,
  subtitle,
  points,
  reference,
  height = 240,
}: {
  title: string;
  subtitle?: string;
  points: readonly ConvergencePoint[];
  reference: number | null;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const measured = useElementSize(ref).width;
  const width = measured > 0 ? measured : 600;
  const [hover, setHover] = useState<number | null>(null);

  const first = points[0]?.trials ?? 1;
  const last = points[points.length - 1]?.trials ?? 1;
  const lowX = Math.log10(first);
  const highX = Math.max(Math.log10(last), lowX + 1);
  const x = (trials: number) =>
    linearScale([lowX, highX], [MARGIN.left, width - MARGIN.right])(Math.log10(trials));
  const values = points.flatMap((p) => [p.interval.low, p.interval.high]);
  if (reference !== null) values.push(reference);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), 4);
  const lo = Math.min(ticks[0] ?? 0, ...values);
  const hi = Math.max(ticks[ticks.length - 1] ?? 1, ...values, lo + 1);
  const y = linearScale([lo, hi], [height - MARGIN.bottom, MARGIN.top]);

  const band =
    points.map((p, i) => `${i ? "L" : "M"}${x(p.trials)},${y(p.interval.high)}`).join("") +
    [...points]
      .reverse()
      .map((p) => `L${x(p.trials)},${y(p.interval.low)}`)
      .join("") +
    "Z";
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.trials)},${y(p.mean)}`).join("");
  const decades: number[] = [];
  for (let d = Math.ceil(lowX); d <= Math.floor(highX); d += 1) decades.push(10 ** d);
  const hovered = hover === null ? null : (points[hover] ?? null);

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Trials</th>
              <th>Mean</th>
              <th>95 % interval</th>
              <th>± half-width</th>
              <th>half-width × √n</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const half = (p.interval.high - p.interval.low) / 2;
              return (
                <tr key={p.trials}>
                  <td>{p.trials.toLocaleString()}</td>
                  <td>{one(p.mean)}</td>
                  <td>
                    {one(p.interval.low)} – {one(p.interval.high)}
                  </td>
                  <td>{half.toFixed(2)}</td>
                  <td>{one(half * Math.sqrt(p.trials))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      }
    >
      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}: running mean after ${points.map((p) => p.trials.toLocaleString()).join(", ")} trials`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-chart-grid"
              />
              <text
                x={MARGIN.left - 6}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-faint font-mono text-[10px]"
              >
                {tick}
              </text>
            </g>
          ))}
          <path d={band} className="fill-series-1/20" />
          {reference !== null && (
            <g>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(reference)}
                y2={y(reference)}
                className="stroke-text"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
              <text
                x={width - MARGIN.right}
                y={y(reference) - 6}
                textAnchor="end"
                className="fill-muted text-[10px]"
                paintOrder="stroke"
                stroke="var(--color-surface)"
                strokeWidth={3}
              >
                planning model {one(reference)}
              </text>
            </g>
          )}
          <path d={line} className="fill-none stroke-series-1" strokeWidth={2} />
          {points.map((p, i) => (
            <g key={p.trials}>
              <circle
                cx={x(p.trials)}
                cy={y(p.mean)}
                r={4}
                className="fill-series-1 stroke-surface"
                strokeWidth={2}
              />
              {/* Larger invisible hit target than the mark. */}
              <circle
                data-testid={`checkpoint-${String(p.trials)}`}
                cx={x(p.trials)}
                cy={y(p.mean)}
                r={14}
                fill="transparent"
                onPointerEnter={() => {
                  setHover(i);
                }}
                onPointerLeave={() => {
                  setHover(null);
                }}
              />
            </g>
          ))}
          <line
            x1={MARGIN.left}
            x2={width - MARGIN.right}
            y1={height - MARGIN.bottom}
            y2={height - MARGIN.bottom}
            className="stroke-border-strong"
          />
          {decades.map((tick) => (
            <text
              key={tick}
              x={x(tick)}
              y={height - MARGIN.bottom + 14}
              textAnchor="middle"
              className="fill-faint font-mono text-[10px]"
            >
              {tick.toLocaleString()}
            </text>
          ))}
          <text
            x={(MARGIN.left + width - MARGIN.right) / 2}
            y={height - 4}
            textAnchor="middle"
            className="fill-muted text-[11px]"
          >
            Trials (logarithmic scale)
          </text>
        </svg>
        {hovered && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-1 rounded border border-border-strong bg-surface-2 px-2 py-1 text-xs whitespace-nowrap shadow"
            style={{ left: Math.min(width - 180, Math.max(0, x(hovered.trials) + 10)) }}
          >
            <div className="text-muted">{hovered.trials.toLocaleString()} trials</div>
            <div>
              mean <span className="font-mono">{one(hovered.mean)}</span>
            </div>
            <div>
              95 %{" "}
              <span className="font-mono">
                {one(hovered.interval.low)} – {one(hovered.interval.high)}
              </span>
            </div>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
