import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { SIMULATE_RESULT } from "@/features/simulation/fixtures";
import { OPTIMIZE_RESULT } from "@/features/strategy/fixtures";
import { useSimulationStore } from "@/stores/simulation";
import { scenarioKey, useStrategyStore } from "@/stores/strategy";
import { SCENARIO_A } from "@/test/fixtures";

import { LatestResults } from "./LatestResults";

describe("LatestResults", () => {
  beforeEach(() => {
    useStrategyStore.setState(useStrategyStore.getInitialState());
    useSimulationStore.setState(useSimulationStore.getInitialState());
  });

  it("invites the user to optimise when nothing has been computed", () => {
    render(
      <MemoryRouter>
        <LatestResults scenario={SCENARIO_A} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Optimise/ })).toHaveAttribute("href", "/strategy");
  });

  it("summarises the latest plan and simulation of this scenario", () => {
    const key = scenarioKey(SCENARIO_A);
    useStrategyStore.setState({ result: OPTIMIZE_RESULT, scenarioKey: key, status: "ready" });
    useSimulationStore.setState({ result: SIMULATE_RESULT, scenarioKey: key, status: "ready" });
    render(
      <MemoryRouter>
        <LatestResults scenario={SCENARIO_A} />
      </MemoryRouter>,
    );
    expect(screen.getByText("54.5")).toBeInTheDocument(); // planning-model expected score
    expect(screen.getByText("127.5")).toBeInTheDocument(); // simulated mean of the first plan
    expect(screen.getByText("12.5%")).toBeInTheDocument(); // cut-off probability
  });

  it("ignores results that belong to another version of the scenario", () => {
    useStrategyStore.setState({ result: OPTIMIZE_RESULT, scenarioKey: "stale", status: "ready" });
    render(
      <MemoryRouter>
        <LatestResults scenario={SCENARIO_A} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("54.5")).not.toBeInTheDocument();
  });
});
