import { useRef, useState } from "react";

import { useElementSize } from "@/hooks/useElementSize";

import { ChartFrame, tableClass } from "./ChartFrame";
import { linearScale, niceTicks } from "./scale";

export interface Marker {
  value: number;
  label: string;
}

interface HistogramProps {
  title: string;
  subtitle?: string;
  edges: readonly number[];
  counts: readonly number[];
  xLabel: string;
  formatBin: (low: number, high: number) => string;
  markers?: readonly Marker[];
  height?: number;
}

const MARGIN = { top: 18, right: 12, bottom: 34, left: 44 };
const GAP = 2;
const RADIUS = 4;

/** Bar with rounded top corners, anchored to the baseline. */
function barPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

export function Histogram({
  title,
  subtitle,
  edges,
  counts,
  xLabel,
  formatBin,
  markers = [],
  height = 220,
}: HistogramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const measured = useElementSize(ref).width;
  const width = measured > 0 ? measured : 600;
  const [hover, setHover] = useState<number | null>(null);

  const total = counts.reduce((sum, c) => sum + c, 0) || 1;
  const shares = counts.map((c) => c / total);
  const maxShare = Math.max(...shares, 1e-9);
  const lo = edges[0] ?? 0;
  const hi = edges[edges.length - 1] ?? 1;
  const x = linearScale([lo, hi], [MARGIN.left, width - MARGIN.right]);
  const yTicks = niceTicks(0, maxShare, 4);
  const yMax = Math.max(yTicks[yTicks.length - 1] ?? maxShare, maxShare);
  const y = linearScale([0, yMax], [height - MARGIN.bottom, MARGIN.top]);
  const xTicks = niceTicks(lo, hi, 6).filter((t) => t >= lo && t <= hi);
  const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

  const hovered =
    hover !== null
      ? { low: edges[hover] ?? 0, high: edges[hover + 1] ?? 0, count: counts[hover] ?? 0 }
      : null;

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Range</th>
              <th>Trials</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((count, i) => (
              <tr key={edges[i]}>
                <td>{formatBin(edges[i] ?? 0, edges[i + 1] ?? 0)}</td>
                <td>{count}</td>
                <td>{percent(count / total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}: histogram of ${total} trials`}
        >
          {yTicks.map((tick) => (
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
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}
          {counts.map((count, i) => {
            const left = x(edges[i] ?? 0) + GAP / 2;
            const right = x(edges[i + 1] ?? 0) - GAP / 2;
            const top = y(count / total);
            const barHeight = height - MARGIN.bottom - top;
            return (
              <g key={edges[i]}>
                {barHeight > 0 && (
                  <path
                    data-testid="histogram-bar"
                    data-height={barHeight}
                    d={barPath(left, top, Math.max(1, right - left), barHeight)}
                    className={hover === i ? "fill-series-1" : "fill-series-1/80"}
                  />
                )}
                <rect
                  data-testid="histogram-hit"
                  x={x(edges[i] ?? 0)}
                  y={MARGIN.top}
                  width={Math.max(1, x(edges[i + 1] ?? 0) - x(edges[i] ?? 0))}
                  height={height - MARGIN.top - MARGIN.bottom}
                  fill="transparent"
                  onPointerEnter={() => {
                    setHover(i);
                  }}
                  onPointerLeave={() => {
                    setHover(null);
                  }}
                />
              </g>
            );
          })}
          {markers.map((marker) => (
            <g key={marker.label} pointerEvents="none">
              <line
                x1={x(marker.value)}
                x2={x(marker.value)}
                y1={MARGIN.top - 6}
                y2={height - MARGIN.bottom}
                className="stroke-text"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text
                x={x(marker.value) > width - 70 ? x(marker.value) - 4 : x(marker.value) + 4}
                y={MARGIN.top - 2}
                textAnchor={x(marker.value) > width - 70 ? "end" : "start"}
                className="fill-muted text-[10px]"
              >
                {marker.label}
              </text>
            </g>
          ))}
          <line
            x1={MARGIN.left}
            x2={width - MARGIN.right}
            y1={height - MARGIN.bottom}
            y2={height - MARGIN.bottom}
            className="stroke-border-strong"
          />
          {xTicks.map((tick) => (
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
        {hovered && hover !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-1 rounded border border-border-strong bg-surface-2 px-2 py-1 text-xs whitespace-nowrap shadow"
            style={{ left: Math.min(width - 180, Math.max(0, x(hovered.low))) }}
          >
            {formatBin(hovered.low, hovered.high)}: {hovered.count} trials (
            {percent(hovered.count / total)})
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
