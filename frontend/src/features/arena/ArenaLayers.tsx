import type { Model, Scenario } from "@/lib/api/client";
import { arenaToScreen, type Viewport } from "@/lib/geometry/viewport";
import { footprintRadius } from "@/lib/robot/footprint";

import { placeLabels } from "./labels";

type Shape = Model<"RectShape"> | Model<"CircleShape">;

import type { Selection } from "./selection";

export type { Selection };

const RAD_TO_DEG = 180 / Math.PI;
const GRID_MIN_CELL_PX = 6;

/** Shape in arena coordinates (drawn inside the arena→screen matrix group). */
function ShapeElement({ shape, ...rest }: { shape: Shape } & React.SVGProps<SVGElement>) {
  if (shape.kind === "circle") {
    return (
      <circle
        cx={shape.cx}
        cy={shape.cy}
        r={shape.radius}
        {...(rest as React.SVGProps<SVGCircleElement>)}
      />
    );
  }
  return (
    <rect
      x={shape.cx - shape.width / 2}
      y={shape.cy - shape.height / 2}
      width={shape.width}
      height={shape.height}
      // Inside the y-up arena frame a positive SVG rotation is counter-clockwise, as in the model.
      transform={`rotate(${shape.rotation * RAD_TO_DEG} ${shape.cx} ${shape.cy})`}
      {...(rest as React.SVGProps<SVGRectElement>)}
    />
  );
}

type ObjectPointerDown = (selection: Selection, event: React.PointerEvent) => void;

function activate(handler: () => void, selection?: Selection, onPointerDown?: ObjectPointerDown) {
  return {
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      handler();
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handler();
      }
    },
    onPointerDown: (event: React.PointerEvent) => {
      event.stopPropagation();
      if (selection && onPointerDown) onPointerDown(selection, event);
    },
  };
}

interface LayersProps {
  scenario: Scenario;
  viewport: Viewport;
  showGrid: boolean;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onObjectPointerDown?: ObjectPointerDown;
  /** Editing: pressing the heading handle of the selected mission or start pose. */
  onHeadingPointerDown?: (event: React.PointerEvent) => void;
}

/** Everything drawn in arena coordinates: field, grid, zones, obstacles, robot footprint. */
export function ArenaGeometry({
  scenario,
  viewport,
  showGrid,
  selection,
  onSelect,
  onObjectPointerDown,
}: LayersProps) {
  const { arena } = scenario;
  const { zoom, panX, panY } = viewport;
  const h = arena.grid_resolution;
  const gridVisible = showGrid && h * zoom >= GRID_MIN_CELL_PX;
  // Same cell count as the planner (backend grid_dimensions): partial edge cells count.
  const columns = Math.ceil(arena.width / h - 1e-9);
  const rows = Math.ceil(arena.height / h - 1e-9);
  const start = arena.start_pose;
  const isSelected = (kind: string, id: string) =>
    selection !== null && selection.kind === kind && "id" in selection && selection.id === id;

  return (
    <g transform={`matrix(${zoom} 0 0 ${-zoom} ${panX} ${panY})`}>
      <rect
        x={0}
        y={0}
        width={arena.width}
        height={arena.height}
        className="fill-field stroke-border-strong"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {gridVisible && (
        <g className="stroke-grid" strokeWidth={1} vectorEffect="non-scaling-stroke">
          {Array.from({ length: columns - 1 }, (_, i) => (
            <line
              key={`c${i}`}
              x1={(i + 1) * h}
              y1={0}
              x2={(i + 1) * h}
              y2={arena.height}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {Array.from({ length: rows - 1 }, (_, j) => (
            <line
              key={`r${j}`}
              x1={0}
              y1={(j + 1) * h}
              x2={arena.width}
              y2={(j + 1) * h}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      )}
      {arena.home_zones.map((zone) => (
        <ShapeElement
          key={zone.id}
          shape={zone.shape}
          role="button"
          tabIndex={0}
          aria-label={`Select home zone ${zone.label}`}
          className="cursor-pointer fill-home/10 stroke-home"
          strokeWidth={isSelected("zone", zone.id) ? 2.5 : 1.25}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          {...activate(
            () => {
              onSelect({ kind: "zone", id: zone.id });
            },
            { kind: "zone", id: zone.id },
            onObjectPointerDown,
          )}
        />
      ))}
      {arena.obstacles.map((obstacle) => (
        <ShapeElement
          key={obstacle.id}
          shape={obstacle.shape}
          data-testid={`obstacle-${obstacle.id}`}
          role="button"
          tabIndex={0}
          aria-label={`Select obstacle ${obstacle.label}`}
          className={
            obstacle.kind === "no_go"
              ? "cursor-pointer fill-[url(#nogo-hatch)] stroke-nogo"
              : "cursor-pointer fill-obstacle stroke-obstacle-edge"
          }
          strokeWidth={isSelected("obstacle", obstacle.id) ? 2.5 : 1}
          vectorEffect="non-scaling-stroke"
          {...activate(
            () => {
              onSelect({ kind: "obstacle", id: obstacle.id });
            },
            { kind: "obstacle", id: obstacle.id },
            onObjectPointerDown,
          )}
        >
          <title>{obstacle.label}</title>
        </ShapeElement>
      ))}
      <circle
        cx={start.x}
        cy={start.y}
        r={footprintRadius(scenario.robot)}
        className="fill-none stroke-start/50"
        strokeDasharray="3 3"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      >
        <title>Robot collision disc at the start pose</title>
      </circle>
    </g>
  );
}

const HEADING_PX = 18;

function headingTip(x: number, y: number, theta: number, length = HEADING_PX) {
  // Screen y points down, so the arena heading's y component flips sign.
  return { x: x + length * Math.cos(theta), y: y - length * Math.sin(theta) };
}

/** Markers and labels drawn in screen space so they keep a constant, legible size. */
export const HANDLE_PX = 34;

export function ArenaOverlay({
  scenario,
  viewport,
  selection,
  onSelect,
  onObjectPointerDown,
  onHeadingPointerDown,
}: LayersProps) {
  const start = arenaToScreen(viewport, scenario.arena.start_pose);
  const startTip = headingTip(start.x, start.y, scenario.arena.start_pose.theta, 16);
  const origin = arenaToScreen(viewport, { x: 0, y: 0 });
  const labels = placeLabels(
    scenario.missions.map((mission) => ({
      ...arenaToScreen(viewport, mission.approach_pose),
      text: mission.name,
    })),
  );

  return (
    <g>
      <text x={origin.x} y={origin.y + 16} className="fill-faint font-mono text-[10px]">
        (0, 0)
      </text>
      <g
        role="button"
        tabIndex={0}
        aria-label="Select start pose"
        className="cursor-pointer"
        {...activate(
          () => {
            onSelect({ kind: "start" });
          },
          { kind: "start" },
          onObjectPointerDown,
        )}
      >
        <line
          x1={start.x}
          y1={start.y}
          x2={startTip.x}
          y2={startTip.y}
          className="stroke-start"
          strokeWidth={2}
          markerEnd="url(#arrow-start)"
        />
        <circle cx={start.x} cy={start.y} r={4} className="fill-start" />
      </g>
      {scenario.missions.map((mission, index) => {
        const p = arenaToScreen(viewport, mission.approach_pose);
        const label = labels[index];
        const tip = headingTip(p.x, p.y, mission.approach_pose.theta);
        const selected = selection?.kind === "mission" && selection.id === mission.id;
        return (
          <g
            key={mission.id}
            role="button"
            tabIndex={0}
            aria-label={`Select mission ${mission.name}`}
            className="cursor-pointer"
            {...activate(
              () => {
                onSelect({ kind: "mission", id: mission.id });
              },
              { kind: "mission", id: mission.id },
              onObjectPointerDown,
            )}
          >
            <line
              x1={p.x}
              y1={p.y}
              x2={tip.x}
              y2={tip.y}
              className="stroke-mission"
              strokeWidth={2}
              markerEnd="url(#arrow-mission)"
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={selected ? 8 : 6}
              className={selected ? "fill-mission stroke-text" : "fill-mission stroke-bg"}
              strokeWidth={2}
            />
            <text
              x={label?.x ?? p.x + 10}
              y={label?.y ?? p.y - 10}
              textAnchor={label?.anchor ?? "start"}
              className="fill-text text-[12px] font-medium"
              paintOrder="stroke"
              stroke="var(--color-bg)"
              strokeWidth={3}
            >
              {mission.name}
            </text>
          </g>
        );
      })}
      {onHeadingPointerDown && (selection?.kind === "mission" || selection?.kind === "start") && (
        <HeadingHandle
          scenario={scenario}
          viewport={viewport}
          selection={selection}
          onPointerDown={onHeadingPointerDown}
        />
      )}
    </g>
  );
}

function HeadingHandle({
  scenario,
  viewport,
  selection,
  onPointerDown,
}: {
  scenario: Scenario;
  viewport: Viewport;
  selection: Selection;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  const pose =
    selection?.kind === "start"
      ? scenario.arena.start_pose
      : selection?.kind === "mission"
        ? scenario.missions.find((m) => m.id === selection.id)?.approach_pose
        : undefined;
  if (!pose) return null;
  const p = arenaToScreen(viewport, pose);
  const tip = headingTip(p.x, p.y, pose.theta, HANDLE_PX);
  return (
    <g>
      <line
        x1={p.x}
        y1={p.y}
        x2={tip.x}
        y2={tip.y}
        className="stroke-accent"
        strokeDasharray="2 2"
      />
      <circle
        data-testid="heading-handle"
        cx={tip.x}
        cy={tip.y}
        r={6}
        className="cursor-grab fill-accent stroke-bg"
        strokeWidth={2}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown(event);
        }}
      >
        <title>Drag to set the heading</title>
      </circle>
    </g>
  );
}

export function ArenaDefs({ zoom }: { zoom: number }) {
  return (
    <defs>
      {/* The hatch is referenced from inside the arena→screen matrix; scale it back to pixels. */}
      <pattern
        id="nogo-hatch"
        patternUnits="userSpaceOnUse"
        width="8"
        height="8"
        patternTransform={`scale(${1 / zoom})`}
      >
        <rect width="8" height="8" fill="var(--color-nogo)" fillOpacity="0.08" />
        <path d="M0 8 L8 0" stroke="var(--color-nogo)" strokeOpacity="0.45" strokeWidth="1" />
      </pattern>
      {(["start", "mission"] as const).map((name) => (
        <marker
          key={name}
          id={`arrow-${name}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill={`var(--color-${name})`} />
        </marker>
      ))}
    </defs>
  );
}
