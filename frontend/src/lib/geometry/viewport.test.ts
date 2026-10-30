import fc from "fast-check";

import {
  arenaToCell,
  arenaToScreen,
  cellCenter,
  DEFAULT_ZOOM_LIMITS,
  fitArena,
  panBy,
  screenToArena,
  zoomAt,
  type Viewport,
} from "./viewport";

const finite = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

const viewportArb: fc.Arbitrary<Viewport> = fc.record({
  zoom: finite(DEFAULT_ZOOM_LIMITS.min, DEFAULT_ZOOM_LIMITS.max),
  panX: finite(-1e4, 1e4),
  panY: finite(-1e4, 1e4),
});
const arenaPointArb = fc.record({ x: finite(-10, 50), y: finite(-10, 50) });
const screenPointArb = fc.record({ x: finite(-5000, 5000), y: finite(-5000, 5000) });

function expectClose(actual: number, expected: number, tolerance = 1e-9) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    tolerance * Math.max(1, Math.abs(expected)),
  );
}

describe("arena ↔ screen transforms", () => {
  it("round-trips arena points", () => {
    fc.assert(
      fc.property(viewportArb, arenaPointArb, (vp, p) => {
        const back = screenToArena(vp, arenaToScreen(vp, p));
        expectClose(back.x, p.x, 1e-7);
        expectClose(back.y, p.y, 1e-7);
      }),
    );
  });

  it("maps arena +y to screen up (smaller screen y)", () => {
    const vp: Viewport = { zoom: 100, panX: 50, panY: 400 };
    expect(arenaToScreen(vp, { x: 0, y: 1 }).y).toBeLessThan(arenaToScreen(vp, { x: 0, y: 0 }).y);
    expect(arenaToScreen(vp, { x: 0, y: 0 })).toEqual({ x: 50, y: 400 });
    expect(arenaToScreen(vp, { x: 2, y: 1 })).toEqual({ x: 250, y: 300 });
  });
});

describe("zoomAt", () => {
  it("keeps the arena point under the cursor fixed", () => {
    fc.assert(
      fc.property(viewportArb, screenPointArb, finite(0.5, 2), (vp, anchor, factor) => {
        const before = screenToArena(vp, anchor);
        const after = screenToArena(zoomAt(vp, anchor, factor), anchor);
        expectClose(after.x, before.x, 1e-6);
        expectClose(after.y, before.y, 1e-6);
      }),
    );
  });

  it("never leaves the zoom limits, however often it is applied", () => {
    fc.assert(
      fc.property(viewportArb, fc.array(finite(0.01, 100), { maxLength: 30 }), (vp, factors) => {
        const end = factors.reduce((v, f) => zoomAt(v, { x: 0, y: 0 }, f), vp);
        expect(end.zoom).toBeGreaterThanOrEqual(DEFAULT_ZOOM_LIMITS.min);
        expect(end.zoom).toBeLessThanOrEqual(DEFAULT_ZOOM_LIMITS.max);
      }),
    );
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "ignores an invalid factor %s",
    (factor) => {
      const vp: Viewport = { zoom: 200, panX: 10, panY: 20 };
      expect(zoomAt(vp, { x: 5, y: 5 }, factor)).toEqual(vp);
    },
  );
});

describe("panBy", () => {
  it("moves the arena with the pointer", () => {
    const vp: Viewport = { zoom: 100, panX: 0, panY: 0 };
    expect(panBy(vp, 15, -5)).toEqual({ zoom: 100, panX: 15, panY: -5 });
  });
});

describe("fitArena", () => {
  it("centres the arena and keeps it inside the padding", () => {
    fc.assert(
      fc.property(
        finite(0.3, 10),
        finite(0.3, 10),
        finite(200, 3000),
        finite(200, 3000),
        (w, h, viewW, viewH) => {
          const padding = 16;
          const vp = fitArena(w, h, viewW, viewH, padding);
          const centre = arenaToScreen(vp, { x: w / 2, y: h / 2 });
          expectClose(centre.x, viewW / 2, 1e-9);
          expectClose(centre.y, viewH / 2, 1e-9);
          const topLeft = arenaToScreen(vp, { x: 0, y: h });
          const bottomRight = arenaToScreen(vp, { x: w, y: 0 });
          if (vp.zoom > DEFAULT_ZOOM_LIMITS.min) {
            expect(topLeft.x).toBeGreaterThanOrEqual(padding - 1e-6);
            expect(topLeft.y).toBeGreaterThanOrEqual(padding - 1e-6);
            expect(bottomRight.x).toBeLessThanOrEqual(viewW - padding + 1e-6);
            expect(bottomRight.y).toBeLessThanOrEqual(viewH - padding + 1e-6);
          }
        },
      ),
    );
  });

  it("returns a usable viewport for a zero-sized container", () => {
    const vp = fitArena(2, 1, 0, 0, 16);
    expect(vp.zoom).toBe(DEFAULT_ZOOM_LIMITS.min);
    expect(Number.isFinite(vp.panX) && Number.isFinite(vp.panY)).toBe(true);
  });
});

describe("grid cells", () => {
  it("maps a cell centre back to the same cell", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0.005, 0.01, 0.02, 0.05, 0.1),
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 0, max: 2000 }),
        (h, i, j) => {
          expect(arenaToCell(cellCenter({ i, j }, h), h)).toEqual({ i, j });
        },
      ),
    );
  });

  it("uses floor so that cell (i, j) covers [i·h, (i+1)·h)", () => {
    expect(arenaToCell({ x: 0.0, y: 0.0 }, 0.02)).toEqual({ i: 0, j: 0 });
    expect(arenaToCell({ x: 0.039, y: 0.021 }, 0.02)).toEqual({ i: 1, j: 1 });
    expect(cellCenter({ i: 2, j: 0 }, 0.02)).toEqual({ x: 0.05, y: 0.01 });
  });
});
