import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { createApiClient } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";
import { useStrategyStore } from "@/stores/strategy";
import { SCENARIO_A } from "@/test/fixtures";

import { OPTIMIZE_RESULT } from "./fixtures";
import { StrategyPage } from "./StrategyPage";

function client(body: unknown, status = 200) {
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      ),
  });
}

function renderPage(api = client(OPTIMIZE_RESULT)) {
  return render(
    <MemoryRouter>
      <StrategyPage client={api} />
    </MemoryRouter>,
  );
}

describe("StrategyPage", () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
    useStrategyStore.setState(useStrategyStore.getInitialState());
  });

  it("asks for a scenario first", () => {
    renderPage();
    expect(screen.getByText(/No scenario loaded/)).toBeInTheDocument();
  });

  it("optimises and compares with the greedy baseline", async () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Optimise" }));
    const optimal = await screen.findByTitle(/Expected value under the planning model/);
    expect(optimal).toHaveTextContent("54.5");
    expect(screen.getByText("Greedy baseline").parentElement).toHaveTextContent("19.0");
    expect(screen.getByText(/\+35\.5 expected points/)).toBeInTheDocument();
  });

  it("explains every decision and lists excluded missions", async () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Optimise" }));
    expect(
      await screen.findByText(/without it the best possible plan scores 35\.5/),
    ).toBeInTheDocument();
    expect(screen.getByText(/needs 130\.0 s even on its own/)).toBeInTheDocument();
    expect(screen.getByText(/Mission durations are the mean/)).toBeInTheDocument();
  });

  it("shows how speed changes the plan", async () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Optimise" }));
    expect(await screen.findByText("×0.8")).toBeInTheDocument();
    expect(screen.getByText(/different missions/)).toBeInTheDocument();
  });

  it("reports constraint errors from the API", async () => {
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    renderPage(
      client(
        {
          code: "invalid_constraints",
          message: "The mission constraints cannot be satisfied.",
          details: [
            { code: "constraint_cycle", message: "The order constraints form a cycle: a → b → a." },
          ],
        },
        422,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Optimise" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cycle: a → b → a");
  });
});
