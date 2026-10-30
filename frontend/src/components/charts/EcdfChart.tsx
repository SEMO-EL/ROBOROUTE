import { useRef, useState, type PointerEvent } from "react";

import { useElementSize } from "@/hooks/useElementSize";

import { ChartFrame, tableClass } from "./ChartFrame";
import { ecdfAt, SERIES_CLASSES, type EcdfSeries } from "./ecdf";
import { linearScale, niceTicks } from "./scale";

const MARGIN = { top: 14, right: 16, bottom: 34, left: 44 };

/**
 * Cumulative distributions of several plans on one axis: for any score x, the share of trials that
 * scored at most x. A curve further to the right is better. At most three plans (validated hues).
 */
export function EcdfChart({
  title,
  subtitle,
  series,
  xLabel,
  target,
  height = 240,
}: {
  title: string;
  subtitle?: string;
  series: readonly EcdfSeries[];
  xLabel: string;
  target?: number | null;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const measured = useElementSize(ref).width;
  const width = measured > 0 ? measured : 600;
  const [hoverX, setHoverX] = useState<number | null>(null);

  const xs = series.flatMap((s) => s.points.map(([px = 0]) => px));
  const lo = Math.min(...xs, 0);
  const hi = Math.max(...xs, target ?? 0, lo + 1);
  const x = linearScale([lo, hi], [MARGIN.left, width - MARGIN.right]);
  const y = linearScale([0, 1], [height - MARGIN.bottom, MARGIN.top]);
  const toValue = linearScale([MARGIN.left, width - MARGIN.right], [lo, hi]);

  const stepPath = (points: readonly (readonly number[])[]) => {
    let d = `M${x(lo)},${y(0)}`;
    for (const [px = 0, f = 0] of points) {
      d += `H${x(px)}V${y(f)}`;
    }
    return `${d}H${x(hi)}`;
  };

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverX(toValue(event.clientX - rect.left));
  }

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Score ≤</th>
              {series.map((s) => (
                <th key={s.label}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {niceTicks(lo, hi, 10).map((tick) => (
              <tr key={tick}>
                <td>{tick}</td>
                {series.map((s) => (
                  <td key={s.label}>{(ecdfAt(s.points, tick) * 100).toFixed(1)}%</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ul aria-label="Legend" className="flex flex-wrap gap-4 text-xs">
        {series.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-0.5 w-4 ${SERIES_CLASSES[i]?.fill ?? ""}`} />
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}: cumulative score distributions of ${series.map((s) => s.label).join(", ")}`}
          onPointerMove={onMove}
          onPointerLeave={() => {
            setHoverX(null);
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
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
                {tick * 100}%
              </text>
            </g>
          ))}
          {target != null && (
            <g pointerEvents="none">
              <line
                x1={x(target)}
                x2={x(target)}
                y1={MARGIN.top}
                y2={height - MARGIN.bottom}
                className="stroke-text"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
              <text x={x(target) + 4} y={MARGIN.top + 10} className="fill-muted text-[10px]">
                target {target}
              </text>
            </g>
          )}
          {series.map((s, i) => (
            <path
              key={s.label}
              d={stepPath(s.points)}
              className={`fill-none ${SERIES_CLASSES[i]?.stroke ?? "stroke-text"}`}
              strokeWidth={2}
            />
          ))}
          {series.map((s, i) => {
            const median = s.points.find(([, f = 0]) => f >= 0.5)?.[0] ?? lo;
            return (
              <text
                key={s.label}
                x={x(median) + 6}
                y={y(0.5) - 6 - i * 14}
                className="fill-text text-[11px]"
                paintOrder="stroke"
                stroke="var(--color-surface)"
                strokeWidth={3}
              >
                {s.label}
              </text>
            );
          })}
          {hoverX !== null && (
            <line
              x1={x(hoverX)}
              x2={x(hoverX)}
              y1={MARGIN.top}
              y2={height - MARGIN.bottom}
              className="stroke-muted"
              strokeWidth={1}
              pointerEvents="none"
            />
          )}
          <line
            x1={MARGIN.left}
            x2={width - MARGIN.right}
            y1={height - MARGIN.bottom}
            y2={height - MARGIN.bottom}
            className="stroke-border-strong"
          />
          {niceTicks(lo, hi, 6)
            .filter((t) => t >= lo && t <= hi)
            .map((tick) => (
              <text
                key={tick}
                x={x(tick)}
                y={height - MARGIN.bottom + 14}
                textAnchor="middle"
                className="fill-faint font-mono text-[10px]"
              >
                {tick}
              </text>
            ))}
          <text
            x={(MARGIN.left + width - MARGIN.right) / 2}
            y={height - 4}
            textAnchor="middle"
            className="fill-muted text-[11px]"
          >
            {xLabel}
          </text>
        </svg>
        {hoverX !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-1 rounded border border-border-strong bg-surface-2 px-2 py-1 text-xs whitespace-nowrap shadow"
            style={{ left: Math.min(width - 200, Math.max(0, x(hoverX) + 8)) }}
          >
            <div className="text-muted">score ≤ {hoverX.toFixed(0)}</div>
            {series.map((s, i) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${SERIES_CLASSES[i]?.fill ?? ""}`}
                />
                {s.label}:{" "}
                <span className="font-mono">{(ecdfAt(s.points, hoverX) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
