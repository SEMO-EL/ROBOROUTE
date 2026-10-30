import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { useProjectStore } from "@/stores/project";
import { SCENARIO_A } from "@/test/fixtures";

import { ArenaPage } from "./ArenaPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <ArenaPage />
    </MemoryRouter>,
  );
}

describe("ArenaPage", () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
  });

  it("explains how to get started when no scenario is loaded", () => {
    renderPage();
    expect(screen.getByText(/No scenario loaded/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Choose a scenario/ })).toHaveAttribute("href", "/");
  });

  it("draws every mission and obstacle of the scenario", () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage();
    for (const mission of SCENARIO_A.missions) {
      expect(screen.getAllByText(mission.name).length).toBeGreaterThan(0);
    }
    for (const obstacle of SCENARIO_A.arena.obstacles) {
      expect(screen.getByTestId(`obstacle-${obstacle.id}`)).toBeInTheDocument();
    }
  });

  it("zooms in with the keyboard", () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage();
    const canvas = screen.getByRole("application", { name: /Arena view/ });
    const before = Number(canvas.dataset.zoom);
    fireEvent.keyDown(canvas, { key: "+" });
    expect(Number(canvas.dataset.zoom)).toBeGreaterThan(before);
  });

  it("shows mission details when a mission is selected", () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Select mission Lower the bridge/ }));
    const panel = screen.getByRole("complementary", { name: "Properties" });
    expect(panel).toHaveTextContent("Lower the bridge");
    expect(panel).toHaveTextContent("110.0 cm, 100.0 cm");
  });
});
