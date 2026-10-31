import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { GridResult, RouteResult } from "@/lib/api/endpoints";

import { SearchStepper } from "./SearchStepper";

const R2 = Math.SQRT2;
const H = 0.1;
// A* (octile, 8 moves) from cell (0,0) to (2,0) on a 3 × 2 grid with 10 cm cells.
const events = [
  { kind: "expand", cell: [0, 0], parent: null, g: 0, h: 0.2, f: 0.2 },
  { kind: "push", cell: [1, 0], parent: [0, 0], g: 0.1, h: 0.1, f: 0.2 },
  { kind: "push", cell: [0, 1], parent: [0, 0], g: 0.1, h: H * (1 + R2), f: 0.1 + H * (1 + R2) },
  { kind: "push", cell: [1, 1], parent: [0, 0], g: H * R2, h: H * R2, f: 2 * H * R2 },
  { kind: "expand", cell: [1, 0], parent: null, g: 0.1, h: 0.1, f: 0.2 },
  { kind: "push", cell: [2, 0], parent: [1, 0], g: 0.2, h: 0, f: 0.2 },
  { kind: "expand", cell: [2, 0], parent: null, g: 0.2, h: 0, f: 0.2 },
] as const;

function route(overrides: Partial<RouteResult> = {}): RouteResult {
  return {
    status: "ok",
    message: "",
    raw_points: [],
    smoothed_points: [],
    length_raw: 0.2,
    length_smoothed: 0.2,
    search: { algorithm: "astar[octile,8]", expanded: 3, cost: 0.2, optimality_guaranteed: true },
    timing: null,
    trace: {
      events: events.map((e) => ({ ...e, cell: [...e.cell], parent: e.parent && [...e.parent] })),
      truncated: false,
    },
    start_cell: [0, 0],
    goal_cell: [2, 0],
    grid_path: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    ...overrides,
  };
}

const GRID: GridResult = {
  columns: 3,
  rows: 2,
  resolution: H,
  inflation: 0.05,
  free_count: 6,
  blocked_runs: [],
};

describe("SearchStepper", () => {
  it("starts before the first expansion with only the start in the frontier", () => {
    render(<SearchStepper route={route()} grid={GRID} />);
    expect(screen.getByText(/step 0 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/before the search starts/i)).toBeInTheDocument();
    expect(screen.getByTestId("frontier-count")).toHaveTextContent("1");
  });

  it("shows g, h and f of the expanded cell and what it pushed", async () => {
    const user = userEvent.setup();
    render(<SearchStepper route={route()} grid={GRID} />);
    await user.click(screen.getByRole("button", { name: "Next step" }));
    const current = screen.getByRole("region", { name: /expanded cell/i });
    expect(within(current).getByText("(0, 0)")).toBeInTheDocument();
    expect(within(current).getByTestId("value-g")).toHaveTextContent("0 cm");
    expect(within(current).getByTestId("value-h")).toHaveTextContent("20 cm");
    expect(within(current).getByTestId("value-f")).toHaveTextContent("20 cm");
    expect(within(current).getByText("10 cm × ((2 − 0) + √2 × 0)")).toBeInTheDocument();
    const pushed = screen.getByRole("table", { name: /neighbours/i });
    expect(within(pushed).getAllByRole("row")).toHaveLength(1 + 3);
  });

  it("reaches the goal and checks the replayed path against the route", async () => {
    const user = userEvent.setup();
    render(<SearchStepper route={route()} grid={GRID} />);
    await user.click(screen.getByRole("button", { name: "Last step" }));
    expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/goal reached/i)).toBeInTheDocument();
    expect(screen.getByText(/matches the route's grid path/i)).toBeInTheDocument();
    expect(screen.getByTestId("replayed-path")).toBeInTheDocument();
  });

  it("moves to any step with the slider", () => {
    render(<SearchStepper route={route()} grid={GRID} />);
    fireEvent.change(screen.getByRole("slider", { name: "Step" }), { target: { value: "2" } });
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText("(1, 0)")).toBeInTheDocument();
  });

  it("plays through the steps", () => {
    vi.useFakeTimers();
    try {
      render(<SearchStepper route={route()} grid={GRID} />);
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says when the recording was cut short and does not claim a final path", async () => {
    const user = userEvent.setup();
    const truncated = route({
      trace: { events: route().trace?.events.slice(0, 5) ?? [], truncated: true },
    });
    render(<SearchStepper route={truncated} grid={GRID} />);
    expect(screen.getByText(/recording stopped/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Last step" }));
    expect(screen.queryByText(/goal reached/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("replayed-path")).not.toBeInTheDocument();
  });

  it("explains an unreachable goal", async () => {
    const user = userEvent.setup();
    const unreachable = route({
      status: "unreachable",
      message: "No collision-free route exists.",
      grid_path: [],
      trace: { events: route().trace?.events.slice(0, 6) ?? [], truncated: false },
    });
    render(<SearchStepper route={unreachable} grid={GRID} />);
    await user.click(screen.getByRole("button", { name: "Last step" }));
    expect(screen.getByText(/frontier became empty/i)).toBeInTheDocument();
  });
});
