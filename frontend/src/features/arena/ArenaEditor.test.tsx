import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { createApiClient } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";
import { SCENARIO_A } from "@/test/fixtures";

import { ArenaPage } from "./ArenaPage";

// In jsdom the canvas has no size, so the view falls back to 10 px/m with the arena origin at
// screen (-10, 6): arena (x, y) is screen (10x − 10, 6 − 10y).
const screenOf = (x: number, y: number) => ({ clientX: 10 * x - 10, clientY: 6 - 10 * y });

const offline = createApiClient({
  baseUrl: "http://api.test",
  fetch: () =>
    Promise.resolve(
      new Response(JSON.stringify({ valid: true, issues: [] }), {
        headers: { "content-type": "application/json" },
      }),
    ),
});

function renderEditor() {
  return render(
    <MemoryRouter>
      <ArenaPage client={offline} />
    </MemoryRouter>,
  );
}

const state = () => useProjectStore.getState();

describe("arena editor", () => {
  beforeEach(() => {
    useProjectStore.setState({
      ...useProjectStore.getInitialState(),
      scenario: SCENARIO_A,
      status: "ready",
    });
  });

  it("adds a mission where the user clicks", async () => {
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add mission" }));
    const svg = screen.getByTestId("arena-svg");
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(1.0, 0.5) });
    fireEvent.pointerUp(svg, screenOf(1.0, 0.5));
    const missions = state().scenario?.missions ?? [];
    expect(missions).toHaveLength(SCENARIO_A.missions.length + 1);
    expect(missions.at(-1)?.approach_pose).toMatchObject({ x: 1.0, y: 0.5 });
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
  });

  it("drags an obstacle and undoes the whole drag in one step", () => {
    renderEditor();
    const svg = screen.getByTestId("arena-svg");
    fireEvent.pointerDown(screen.getByTestId("obstacle-tower"), {
      button: 0,
      ...screenOf(1.35, 0.75),
    });
    fireEvent.pointerMove(svg, screenOf(1.42, 0.75));
    fireEvent.pointerMove(svg, screenOf(1.5, 0.75));
    fireEvent.pointerUp(svg, screenOf(1.5, 0.75));
    const tower = () => state().scenario?.arena.obstacles.find((o) => o.id === "tower")?.shape;
    expect(tower()?.cx).toBeCloseTo(1.5);
    expect(state().past).toHaveLength(1);
    state().undo();
    expect(tower()?.cx).toBeCloseTo(1.35);
  });

  it("deletes the selected mission with the Delete key and undoes with Ctrl+Z", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Select mission Lower the bridge/ }));
    fireEvent.keyDown(window, { key: "Delete" });
    expect(state().scenario?.missions.map((m) => m.id)).not.toContain("bridge");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(state().scenario?.missions.map((m) => m.id)).toContain("bridge");
  });
});
