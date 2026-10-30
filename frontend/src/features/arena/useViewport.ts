import { useCallback, useState } from "react";

import type { Size } from "@/hooks/useElementSize";
import { fitArena, panBy, zoomAt, type Vec2, type Viewport } from "@/lib/geometry/viewport";

const PADDING = 24;

/**
 * Viewport state for an arena of the given size.
 *
 * The view is re-fitted whenever the arena dimensions change or the container is measured for
 * the first time; user zoom and pan are kept otherwise (also across window resizes).
 */
export function useViewport(arenaWidth: number, arenaHeight: number, container: Size) {
  const fitted = () =>
    fitArena(arenaWidth, arenaHeight, container.width, container.height, PADDING);
  const [viewport, setViewport] = useState<Viewport>(fitted);

  const fitKey = `${arenaWidth}x${arenaHeight}:${container.width > 0 && container.height > 0}`;
  const [lastFitKey, setLastFitKey] = useState(fitKey);
  if (fitKey !== lastFitKey) {
    // Adjusting state while rendering (instead of in an effect) avoids a frame with a stale view.
    setLastFitKey(fitKey);
    setViewport(fitted());
  }

  const fit = useCallback(() => {
    setViewport(fitArena(arenaWidth, arenaHeight, container.width, container.height, PADDING));
  }, [arenaWidth, arenaHeight, container.width, container.height]);

  const zoom = useCallback((anchor: Vec2, factor: number) => {
    setViewport((vp) => zoomAt(vp, anchor, factor));
  }, []);

  const pan = useCallback((dx: number, dy: number) => {
    setViewport((vp) => panBy(vp, dx, dy));
  }, []);

  return { viewport, fit, zoom, pan };
}
