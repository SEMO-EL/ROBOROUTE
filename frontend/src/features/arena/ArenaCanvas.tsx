import { Grid3x3, Maximize, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { useElementSize } from "@/hooks/useElementSize";
import type { Scenario } from "@/lib/api/client";
import { formatLength } from "@/lib/format/units";
import { screenToArena, type Vec2 } from "@/lib/geometry/viewport";

import { ArenaDefs, ArenaGeometry, ArenaOverlay, type Selection } from "./ArenaLayers";
import { niceScaleLength } from "./scaleBar";
import { useViewport } from "./useViewport";

const ZOOM_STEP = 1.25;
const PAN_STEP_PX = 40;

interface ArenaCanvasProps {
  scenario: Scenario;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}

export function ArenaCanvas({ scenario, selection, onSelect }: ArenaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(containerRef);
  const { viewport, fit, zoom, pan } = useViewport(
    scenario.arena.width,
    scenario.arena.height,
    size,
  );
  const [showGrid, setShowGrid] = useState(true);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // React registers wheel listeners as passive, which cannot prevent page scrolling.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      zoom(anchor, Math.exp(-event.deltaY * 0.0015));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  }, [zoom]);

  const centre = { x: size.width / 2, y: size.height / 2 };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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
      Escape: () => {
        onSelect(null);
      },
    };
    const action = actions[event.key];
    if (action && event.target === event.currentTarget) {
      event.preventDefault();
      action();
    }
  }

  function localPoint(event: PointerEvent): Vec2 {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
    onSelect(null);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    setCursor(screenToArena(viewport, localPoint(event)));
    if (drag.current) {
      pan(event.clientX - drag.current.x, event.clientY - drag.current.y);
      drag.current = { x: event.clientX, y: event.clientY };
    }
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const scaleLength = niceScaleLength(viewport.zoom);
  const buttonClass =
    "flex size-8 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text aria-pressed:text-accent";

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
          width={size.width}
          height={size.height}
          className="block touch-none select-none"
          onPointerDown={onPointerDown}
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
          />
          <ArenaOverlay
            scenario={scenario}
            viewport={viewport}
            showGrid={showGrid}
            selection={selection}
            onSelect={onSelect}
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
