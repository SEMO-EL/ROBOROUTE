import { Grid3x3, Maximize, Minus, Plus } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { useElementSize } from "@/hooks/useElementSize";
import type { Scenario } from "@/lib/api/client";
import { formatLength } from "@/lib/format/units";
import { screenToArena, type Vec2 } from "@/lib/geometry/viewport";

import { ArenaDefs, ArenaGeometry, ArenaOverlay } from "./ArenaLayers";
import { positionOf } from "./editing";
import { niceScaleLength } from "./scaleBar";
import type { Selection } from "./selection";
import { useViewport } from "./useViewport";

const ZOOM_STEP = 1.25;
const PAN_STEP_PX = 40;

export type Tool = "select" | "rect" | "circle" | "nogo" | "mission";
export type GesturePhase = "start" | "move" | "end";

export interface ArenaEditing {
  tool: Tool;
  /** An add-tool was used on empty space at this arena point. */
  onPlace: (point: Vec2) => void;
  /** The selected object is being dragged; `position` is its new centre / pose position. */
  onDrag: (selection: Selection, position: Vec2, phase: GesturePhase) => void;
  /** The heading handle of the selected mission / start pose is being dragged. */
  onHeading: (selection: Selection, theta: number, phase: GesturePhase) => void;
}

interface ArenaCanvasProps {
  scenario: Scenario;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  /** Extra layers drawn in arena coordinates (metres, y up), above obstacles. */
  arenaLayers?: ReactNode;
  /** Present when the canvas edits the scenario; absent for read-only views. */
  editing?: ArenaEditing;
}

type Drag =
  | { mode: "pan"; last: Vec2 }
  | { mode: "object"; selection: Selection; offset: Vec2; moved: boolean }
  | { mode: "heading"; selection: Selection; origin: Vec2 };

export function ArenaCanvas({
  scenario,
  selection,
  onSelect,
  arenaLayers,
  editing,
}: ArenaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const size = useElementSize(containerRef);
  const { viewport, fit, zoom, pan } = useViewport(
    scenario.arena.width,
    scenario.arena.height,
    size,
  );
  const [showGrid, setShowGrid] = useState(true);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const drag = useRef<Drag | null>(null);

  // React registers wheel listeners as passive, which cannot prevent page scrolling.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoom(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        Math.exp(-event.deltaY * 0.0015),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  }, [zoom]);

  const centre = { x: size.width / 2, y: size.height / 2 };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey) return;
    const actions: Record<string, () => void> = {
      "+": () => {
        zoom(centre, ZOOM_STEP);
      },
      "=": () => {
        zoom(centre, ZOOM_STEP);
      },
      "-": () => {
        zoom(centre, 1 / ZOOM_STEP);
      },
      "0": fit,
      Escape: () => {
        onSelect(null);
      },
    };
    // With an editable selection the page uses the arrow keys to nudge the object.
    if (!(editing && selection)) {
      Object.assign(actions, {
        ArrowLeft: () => {
          pan(PAN_STEP_PX, 0);
        },
        ArrowRight: () => {
          pan(-PAN_STEP_PX, 0);
        },
        ArrowUp: () => {
          pan(0, PAN_STEP_PX);
        },
        ArrowDown: () => {
          pan(0, -PAN_STEP_PX);
        },
      });
    }
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  /** Pointer position in arena coordinates (always relative to the SVG, not the event target). */
  function arenaPoint(event: PointerEvent): Vec2 {
    const rect = svgRef.current?.getBoundingClientRect();
    const local = { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
    return screenToArena(viewport, local);
  }

  function capture(pointerId: number) {
    const svg = svgRef.current;
    if (svg && typeof svg.setPointerCapture === "function") svg.setPointerCapture(pointerId);
  }

  function onBackgroundPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    if (editing && editing.tool !== "select") {
      editing.onPlace(arenaPoint(event));
      return;
    }
    capture(event.pointerId);
    drag.current = { mode: "pan", last: { x: event.clientX, y: event.clientY } };
    onSelect(null);
  }

  function onObjectPointerDown(target: Selection, event: PointerEvent) {
    onSelect(target);
    if (!editing || editing.tool !== "select" || event.button !== 0) return;
    const position = positionOf(scenario, target);
    if (!position) return;
    const point = arenaPoint(event);
    capture(event.pointerId);
    drag.current = {
      mode: "object",
      selection: target,
      offset: { x: point.x - position.x, y: point.y - position.y },
      moved: false,
    };
  }

  function onHeadingPointerDown(event: PointerEvent) {
    if (!editing || !selection) return;
    const origin = positionOf(scenario, selection);
    if (!origin) return;
    capture(event.pointerId);
    drag.current = { mode: "heading", selection, origin };
    const point = arenaPoint(event);
    editing.onHeading(selection, Math.atan2(point.y - origin.y, point.x - origin.x), "start");
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const point = arenaPoint(event);
    setCursor(point);
    const current = drag.current;
    if (!current) return;
    if (current.mode === "pan") {
      pan(event.clientX - current.last.x, event.clientY - current.last.y);
      drag.current = { mode: "pan", last: { x: event.clientX, y: event.clientY } };
    } else if (current.mode === "object" && editing) {
      if (!current.moved) {
        editing.onDrag(
          current.selection,
          { x: point.x - current.offset.x, y: point.y - current.offset.y },
          "start",
        );
        current.moved = true;
      }
      editing.onDrag(
        current.selection,
        { x: point.x - current.offset.x, y: point.y - current.offset.y },
        "move",
      );
    } else if (current.mode === "heading" && editing) {
      editing.onHeading(
        current.selection,
        Math.atan2(point.y - current.origin.y, point.x - current.origin.x),
        "move",
      );
    }
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    drag.current = null;
    const svg = svgRef.current;
    if (
      svg &&
      typeof svg.hasPointerCapture === "function" &&
      svg.hasPointerCapture(event.pointerId)
    ) {
      svg.releasePointerCapture(event.pointerId);
    }
    if (!editing || !current) return;
    const point = arenaPoint(event);
    if (current.mode === "object" && current.moved) {
      editing.onDrag(
        current.selection,
        { x: point.x - current.offset.x, y: point.y - current.offset.y },
        "end",
      );
    } else if (current.mode === "heading") {
      editing.onHeading(
        current.selection,
        Math.atan2(point.y - current.origin.y, point.x - current.origin.x),
        "end",
      );
    }
  }

  const scaleLength = niceScaleLength(viewport.zoom);
  const buttonClass =
    "flex size-8 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text aria-pressed:text-accent";
  const placing = editing && editing.tool !== "select";

  return (
    <div className="relative h-full min-h-0 w-full">
      <div
        ref={containerRef}
        role="application"
        aria-label="Arena view. Use plus and minus to zoom, arrow keys to pan, 0 to fit."
        aria-roledescription="arena canvas"
        tabIndex={0}
        data-zoom={viewport.zoom}
        onKeyDown={onKeyDown}
        className="h-full w-full overflow-hidden bg-bg"
      >
        <svg
          ref={svgRef}
          data-testid="arena-svg"
          width={size.width}
          height={size.height}
          className={`block touch-none select-none ${placing ? "cursor-crosshair" : ""}`}
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            setCursor(null);
          }}
        >
          <ArenaDefs zoom={viewport.zoom} />
          <ArenaGeometry
            scenario={scenario}
            viewport={viewport}
            showGrid={showGrid}
            selection={selection}
            onSelect={onSelect}
            onObjectPointerDown={onObjectPointerDown}
          />
          {arenaLayers && (
            <g
              pointerEvents="none"
              transform={`matrix(${viewport.zoom} 0 0 ${-viewport.zoom} ${viewport.panX} ${viewport.panY})`}
            >
              {arenaLayers}
            </g>
          )}
          <ArenaOverlay
            scenario={scenario}
            viewport={viewport}
            showGrid={showGrid}
            selection={selection}
            onSelect={onSelect}
            onObjectPointerDown={onObjectPointerDown}
            {...(editing ? { onHeadingPointerDown } : {})}
          />
        </svg>
      </div>

      <div className="absolute top-3 right-3 flex flex-col gap-0.5 rounded-lg border border-border bg-surface/95 p-1">
        <button
          type="button"
          className={buttonClass}
          aria-label="Zoom in"
          title="Zoom in (+)"
          onClick={() => {
            zoom(centre, ZOOM_STEP);
          }}
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={buttonClass}
          aria-label="Zoom out"
          title="Zoom out (−)"
          onClick={() => {
            zoom(centre, 1 / ZOOM_STEP);
          }}
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={buttonClass}
          aria-label="Fit arena"
          title="Fit (0)"
          onClick={fit}
        >
          <Maximize aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={buttonClass}
          aria-label="Show grid"
          aria-pressed={showGrid}
          title="Planning grid"
          onClick={() => {
            setShowGrid((value) => !value);
          }}
        >
          <Grid3x3 aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-4 font-mono text-xs text-muted">
        <div className="flex flex-col gap-1">
          <div
            className="h-1.5 border-x border-b border-muted"
            style={{ width: `${scaleLength * viewport.zoom}px` }}
          />
          <span>{formatLength(scaleLength, 0)}</span>
        </div>
        <span aria-live="off">
          {cursor ? `x ${formatLength(cursor.x)}   y ${formatLength(cursor.y)}` : " "}
        </span>
      </div>
    </div>
  );
}
