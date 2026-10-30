import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { createApiClient } from "@/lib/api/client";
import { OPTIMIZE_RESULT } from "@/features/strategy/fixtures";
import { useProjectStore } from "@/stores/project";
import { useSimulationStore } from "@/stores/simulation";
import { scenarioKey, useStrategyStore } from "@/stores/strategy";
import { SCENARIO_A } from "@/test/fixtures";

import { SIMULATE_RESULT } from "./fixtures";
import { SimulationPage } from "./SimulationPage";

function client(requests: unknown[] = []) {
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: async (request) => {
      requests.push(await request.clone().json());
      return new Response(JSON.stringify(SIMULATE_RESULT), {
        headers: { "content-type": "application/json" },
      });
    },
  });
}

function renderPage(api = client()) {
  return render(
    <MemoryRouter>
      <SimulationPage client={api} />
    </MemoryRouter>,
  );
}

function withOptimisation() {
  useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
  useStrategyStore.setState({
    result: OPTIMIZE_RESULT,
    scenarioKey: scenarioKey(SCENARIO_A),
    status: "ready",
  });
}

describe("SimulationPage", () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
    useStrategyStore.setState(useStrategyStore.getInitialState());
    useSimulationStore.setState(useSimulationStore.getInitialState());
  });

  it("asks for a scenario first", () => {
    renderPage();
    expect(screen.getByText(/No scenario loaded/)).toBeInTheDocument();
  });

  it("asks for an optimisation before plans can be simulated", () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage();
    expect(screen.getByRole("button", { name: "Optimise now" })).toBeInTheDocument();
  });

  it("simulates the optimal and greedy plans by default", async () => {
    withOptimisation();
    const requests: unknown[] = [];
    renderPage(client(requests));
    expect(screen.getByRole("checkbox", { name: /Optimal/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Greedy/ })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Run simulation" }));
    expect(await screen.findByText("Plans compared")).toBeInTheDocument();
    const body = requests[0] as { plans: { label: string }[] };
    expect(body.plans.map((p) => p.label)).toEqual(["Optimal", "Greedy"]);
  });

  it("points out when another plan beats the model-optimal plan under uncertainty", async () => {
    withOptimisation();
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Run simulation" }));
    expect(await screen.findByRole("note")).toHaveTextContent(
      /Greedy scores more on average than Optimal/,
    );
  });

  it("allows at most three plans", async () => {
    withOptimisation();
    renderPage();
    await userEvent.click(screen.getByRole("checkbox", { name: /Alternative 1/ }));
    expect(screen.getByRole("checkbox", { name: /Alternative 1/ })).toBeChecked();
    // Optimal, Greedy and Alternative 1 are selected: nothing else can be added.
    const others = screen
      .getAllByRole("checkbox")
      .filter((box) => !(box as HTMLInputElement).checked);
    expect(others.every((box) => (box as HTMLInputElement).disabled)).toBe(true);
  });
});
