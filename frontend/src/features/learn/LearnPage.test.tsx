import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { OPTIMIZE_RESULT } from "@/features/strategy/fixtures";
import { SIMULATE_RESULT } from "@/features/simulation/fixtures";
import { createApiClient } from "@/lib/api/client";
import type { OptimizeResult } from "@/lib/api/endpoints";
import { blankScenario } from "@/lib/scenario/blank";
import { useProjectStore } from "@/stores/project";
import { useSimulationStore } from "@/stores/simulation";
import { scenarioKey, useStrategyStore } from "@/stores/strategy";
import { SCENARIO_A } from "@/test/fixtures";

import { LearnPage } from "./LearnPage";

const ROUTE = {
  status: "ok",
  message: "",
  raw_points: [],
  smoothed_points: [],
  length_raw: 0.2,
  length_smoothed: 0.2,
  search: { algorithm: "astar[octile,8]", expanded: 2, cost: 0.1, optimality_guaranteed: true },
  timing: null,
  trace: {
    events: [
      { kind: "expand", cell: [0, 0], parent: null, g: 0, h: 0.1, f: 0.1 },
      { kind: "push", cell: [1, 0], parent: [0, 0], g: 0.1, h: 0, f: 0.1 },
      { kind: "expand", cell: [1, 0], parent: null, g: 0.1, h: 0, f: 0.1 },
    ],
    truncated: false,
  },
  start_cell: [0, 0],
  goal_cell: [1, 0],
  grid_path: [
    [0, 0],
    [1, 0],
  ],
};
const GRID = {
  columns: 2,
  rows: 1,
  resolution: 0.1,
  inflation: 0.05,
  free_count: 2,
  blocked_runs: [],
};

function client(requests: { url: string; body: unknown }[] = []) {
  const responses: Record<string, unknown> = {
    "/api/v1/routes/plan": ROUTE,
    "/api/v1/routes/grid": GRID,
    "/api/v1/optimize": OPTIMIZE_RESULT,
    "/api/v1/simulate": SIMULATE_RESULT,
  };
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: async (request) => {
      const url = new URL(request.url).pathname;
      requests.push({ url, body: await request.clone().json() });
      return new Response(JSON.stringify(responses[url]), {
        headers: { "content-type": "application/json" },
      });
    },
  });
}

function renderPage(topic = "pathfinding", api = client()) {
  return render(
    <MemoryRouter initialEntries={[`/learn?topic=${topic}`]}>
      <LearnPage client={api} />
    </MemoryRouter>,
  );
}

// Steps consistent with the plan's completion time: 4 + 4 + 5 + 8.67 = 21.67 s.
const CONSISTENT: OptimizeResult = {
  ...OPTIMIZE_RESULT,
  optimal: {
    runs: [["beacon", "bridge"]],
    expected_score: 54.5,
    completion_time: 21.67,
    route: [],
    steps: [
      { kind: "travel", from_node: "start", to_node: "beacon", seconds: 4, provenance: "modeled" },
      {
        kind: "mission",
        from_node: "beacon",
        to_node: "beacon",
        seconds: 4,
        provenance: "planned",
      },
      { kind: "travel", from_node: "beacon", to_node: "bridge", seconds: 5, provenance: "modeled" },
      {
        kind: "mission",
        from_node: "bridge",
        to_node: "bridge",
        seconds: 8.67,
        provenance: "planned",
      },
    ],
  },
};

describe("LearnPage", () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
    useStrategyStore.setState(useStrategyStore.getInitialState());
    useSimulationStore.setState(useSimulationStore.getInitialState());
  });

  it("asks for a scenario first", () => {
    renderPage();
    expect(screen.getByText(/no scenario loaded/i)).toBeInTheDocument();
  });

  it("explains on every tab what is missing when the scenario has no missions", async () => {
    const user = userEvent.setup();
    useProjectStore.setState({ scenario: blankScenario("single_run"), status: "ready" });
    renderPage();
    expect(screen.getByText(/nowhere to plan a route to/i)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Optimisation" }));
    expect(screen.getByText(/no missions to choose from/i)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Simulation" }));
    expect(screen.getByText(/no missions to simulate/i)).toBeInTheDocument();
  });

  it("plans a route with a trace and opens the step-through", async () => {
    const user = userEvent.setup();
    const requests: { url: string; body: unknown }[] = [];
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage("pathfinding", client(requests));
    await user.click(screen.getByRole("button", { name: "Plan route" }));
    expect(await screen.findByText(/step 0 of 2/i)).toBeInTheDocument();
    const plan = requests.find((r) => r.url === "/api/v1/routes/plan");
    expect(plan?.body).toMatchObject({ include_trace: true });
  });

  it("writes the DP recurrence out along the optimal plan", () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    useStrategyStore.setState({
      result: CONSISTENT,
      scenarioKey: scenarioKey(SCENARIO_A),
      status: "ready",
    });
    renderPage("optimisation");
    expect(screen.getByText(/2³ = 8 subsets/)).toBeInTheDocument();
    const best = screen.getByRole("table", { name: /best mission sets/i });
    expect(within(best).getAllByRole("row")).toHaveLength(1 + 3);
    const recurrence = screen.getByRole("table", { name: /recurrence/i });
    expect(within(recurrence).getAllByRole("row")).toHaveLength(1 + 2);
    expect(screen.getByText(/equals the plan's completion time/i)).toBeInTheDocument();
  });

  it("explains the random variables of the simulated plan and its convergence", () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    useSimulationStore.setState({
      result: SIMULATE_RESULT,
      request: {
        scenario: SCENARIO_A,
        plans: [{ label: "Optimal", runs: [["beacon", "bridge"]] }],
        config: {
          trials: 1000,
          seed: 7,
          travel_time_cv: 0.1,
          skip_if_insufficient_time: true,
          target_score: null,
        },
      },
      scenarioKey: scenarioKey(SCENARIO_A),
      status: "ready",
    });
    renderPage("simulation");
    const variables = screen.getByRole("table", { name: /random variables/i });
    expect(within(variables).getByText("Light the beacon")).toBeInTheDocument();
    expect(within(variables).getByText("always 4.0 s")).toBeInTheDocument();
    expect(within(variables).queryByText("Lift the crane hook")).not.toBeInTheDocument();
    expect(screen.getByText(/coefficient of variation 10 %/i)).toBeInTheDocument();
    expect(screen.getByText(/running mean score/i)).toBeInTheDocument();
  });

  it("can simulate the optimal plan itself without replacing the Simulation page's results", async () => {
    const user = userEvent.setup();
    const requests: { url: string; body: unknown }[] = [];
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage("simulation", client(requests));
    await user.click(screen.getByRole("button", { name: /simulate the optimal plan/i }));
    expect(await screen.findByText(/running mean score/i)).toBeInTheDocument();
    const simulate = requests.find((r) => r.url === "/api/v1/simulate");
    expect(simulate?.body).toMatchObject({
      plans: [{ label: "Optimal", runs: OPTIMIZE_RESULT.optimal?.runs }],
    });
    expect(useSimulationStore.getState().result).toBeNull();
  });
});

describe("LearnPage tabs", () => {
  it("keeps every tab's panel so switching tabs does not lose a lesson's state", async () => {
    const user = userEvent.setup();
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage("pathfinding");
    await user.click(screen.getByRole("button", { name: "Plan route" }));
    expect(await screen.findByText(/step 0 of 2/i)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Optimisation" }));
    await user.click(screen.getByRole("tab", { name: "Pathfinding" }));
    expect(screen.getByText(/step 0 of 2/i)).toBeInTheDocument();
    for (const tab of screen.getAllByRole("tab")) {
      expect(document.getElementById(tab.getAttribute("aria-controls") ?? "")).not.toBeNull();
    }
  });

  it("moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage("pathfinding");
    screen.getByRole("tab", { name: "Pathfinding" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Optimisation" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Optimisation" })).toHaveFocus();
  });
});
