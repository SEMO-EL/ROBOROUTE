import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { SIMULATE_RESULT } from "@/features/simulation/fixtures";
import { createApiClient } from "@/lib/api/client";
import { MemoryStorage } from "@/lib/storage/memoryStorage";
import {
  isStoredExperiment,
  LocalRepository,
  type StoredExperiment,
} from "@/lib/storage/repository";
import { SCENARIO_A } from "@/test/fixtures";

import { ExperimentsPage } from "./ExperimentsPage";

const EXPERIMENT: StoredExperiment = {
  id: "e1",
  name: "Optimal vs greedy",
  createdAt: "2026-10-31T10:00:00.000Z",
  projectId: "p1",
  request: {
    scenario: SCENARIO_A,
    plans: [
      { label: "Optimal", runs: [["beacon"]] },
      { label: "Greedy", runs: [["bridge"]] },
    ],
    config: {
      trials: 1000,
      seed: 7,
      travel_time_cv: 0.1,
      skip_if_insufficient_time: true,
      target_score: 100,
    },
  },
  result: SIMULATE_RESULT,
};

function client(result: unknown) {
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } }),
      ),
  });
}

function setup(api = client(SIMULATE_RESULT)) {
  const repo = new LocalRepository<StoredExperiment>(
    "experiment",
    isStoredExperiment,
    new MemoryStorage(),
  );
  repo.save(EXPERIMENT);
  repo.save({ ...EXPERIMENT, id: "e2", name: "Second run", createdAt: "2026-10-31T11:00:00.000Z" });
  render(
    <MemoryRouter>
      <ExperimentsPage repository={repo} client={api} />
    </MemoryRouter>,
  );
  return repo;
}

describe("ExperimentsPage", () => {
  it("lists experiments, newest first", () => {
    setup();
    const names = within(screen.getByRole("list", { name: "Experiments" }))
      .getAllByRole("heading")
      .map((h) => h.textContent);
    expect(names).toEqual(["Second run", "Optimal vs greedy"]);
  });

  it("shows the saved results of the selected experiment", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "View Optimal vs greedy" }));
    expect(screen.getByText(/seed 7/)).toBeInTheDocument();
    expect(screen.getAllByText("Greedy").length).toBeGreaterThan(0);
  });

  it("confirms an exact reproduction", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "View Optimal vs greedy" }));
    await userEvent.click(screen.getByRole("button", { name: "Reproduce" }));
    expect(await screen.findByText(/Reproduced exactly/)).toBeInTheDocument();
  });

  it("reports when a re-run gives different results", async () => {
    const changed = {
      ...SIMULATE_RESULT,
      metadata: { ...SIMULATE_RESULT.metadata, numpy_version: "9.9.9" },
      plans: SIMULATE_RESULT.plans.map((p) => ({
        ...p,
        score: { ...p.score, mean: p.score.mean + 1 },
      })),
    };
    setup(client(changed));
    await userEvent.click(screen.getByRole("button", { name: "View Optimal vs greedy" }));
    await userEvent.click(screen.getByRole("button", { name: "Reproduce" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/differ.*NumPy 2\.5\.4 → 9\.9\.9/);
  });

  it("asks before deleting", async () => {
    const repo = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete Second run" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(repo.get("e2")).toBeNull();
  });

  it("compares two experiments side by side", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Compare Optimal vs greedy" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Compare Second run" }));
    const table = screen.getByRole("table", { name: "Experiment comparison" });
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 4);
  });
});
