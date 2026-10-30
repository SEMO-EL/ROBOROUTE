/**
 * Coordinate transforms between the arena, the screen and the planning grid
 * (design doc §5, ADR-001).
 *
 * Arena frame: metres, origin at the bottom-left corner of the field, +x right, +y up.
 * Screen frame: CSS pixels, origin at the top-left of the canvas, +y DOWN.
 * A viewport is fully described by its zoom (pixels per metre) and the screen position of the
 * arena origin (panX, panY):
 *
 *   sx = panX + zoom · x          x = (sx − panX) / zoom
 *   sy = panY − zoom · y          y = (panY − sy) / zoom
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Viewport {
  /** Pixels per metre. */
  zoom: number;
  /** Screen x of the arena origin. */
  panX: number;
  /** Screen y of the arena origin. */
  panY: number;
}

export interface ZoomLimits {
  min: number;
  max: number;
}

/** 10 px/m shows a 50 m area on a laptop; 5000 px/m shows 1 cm as 50 px. */
export const DEFAULT_ZOOM_LIMITS: ZoomLimits = { min: 10, max: 5000 };

export interface Cell {
  i: number;
  j: number;
}

export function arenaToScreen(vp: Viewport, p: Vec2): Vec2 {
  return { x: vp.panX + vp.zoom * p.x, y: vp.panY - vp.zoom * p.y };
}

export function screenToArena(vp: Viewport, s: Vec2): Vec2 {
  return { x: (s.x - vp.panX) / vp.zoom, y: (vp.panY - s.y) / vp.zoom };
}

function clamp(value: number, limits: ZoomLimits): number {
  return Math.min(limits.max, Math.max(limits.min, value));
}

/**
 * Zoom by `factor` about a screen-space anchor (usually the cursor). The arena point under the
 * anchor stays under the anchor. Invalid factors (≤ 0, NaN, ∞) leave the viewport unchanged.
 */
export function zoomAt(
  vp: Viewport,
  anchor: Vec2,
  factor: number,
  limits: ZoomLimits = DEFAULT_ZOOM_LIMITS,
): Viewport {
  if (!Number.isFinite(factor) || factor <= 0) return vp;
  const zoom = clamp(vp.zoom * factor, limits);
  const fixed = screenToArena(vp, anchor);
  return { zoom, panX: anchor.x - zoom * fixed.x, panY: anchor.y + zoom * fixed.y };
}

export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { zoom: vp.zoom, panX: vp.panX + dx, panY: vp.panY + dy };
}

/** The largest zoom that shows the whole arena inside the view, centred, with padding. */
export function fitArena(
  arenaWidth: number,
  arenaHeight: number,
  viewWidth: number,
  viewHeight: number,
  padding: number,
  limits: ZoomLimits = DEFAULT_ZOOM_LIMITS,
): Viewport {
  const usableW = Math.max(0, viewWidth - 2 * padding);
  const usableH = Math.max(0, viewHeight - 2 * padding);
  const zoom = clamp(Math.min(usableW / arenaWidth, usableH / arenaHeight), limits);
  return {
    zoom,
    panX: (viewWidth - zoom * arenaWidth) / 2,
    panY: (viewHeight + zoom * arenaHeight) / 2,
  };
}

/** Grid cell (column i, row j) containing an arena point; cell (i, j) covers [i·h, (i+1)·h). */
export function arenaToCell(p: Vec2, h: number): Cell {
  return { i: Math.floor(p.x / h), j: Math.floor(p.y / h) };
}

export function cellCenter(cell: Cell, h: number): Vec2 {
  return { x: (cell.i + 0.5) * h, y: (cell.j + 0.5) * h };
}
