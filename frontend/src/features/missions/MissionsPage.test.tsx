import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { createApiClient } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";
import { SCENARIO_A } from "@/test/fixtures";

import { MissionsPage } from "./MissionsPage";

function client(report: unknown = { valid: true, issues: [] }) {
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify(report), { headers: { "content-type": "application/json" } }),
      ),
  });
}

function renderPage(api = client()) {
  return render(
    <MemoryRouter>
      <MissionsPage client={api} />
    </MemoryRouter>,
  );
}

const scenario = () => useProjectStore.getState().scenario;

describe("MissionsPage", () => {
  beforeEach(() => {
    useProjectStore.setState({
      ...useProjectStore.getInitialState(),
      scenario: SCENARIO_A,
      status: "ready",
    });
  });

  it("asks for a scenario first", () => {
    useProjectStore.setState(useProjectStore.getInitialState());
    renderPage();
    expect(screen.getByText(/No scenario loaded/)).toBeInTheDocument();
  });

  it("edits the points of the selected mission", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Lower the bridge/ }));
    const points = screen.getByLabelText("Points (pts)");
    await userEvent.clear(points);
    await userEvent.type(points, "50{Enter}");
    const rule = scenario()?.scoring.rules.find(
      (r) => r.kind === "mission_points" && r.mission === "bridge",
    );
    expect(rule).toMatchObject({ points: 50 });
  });

  it("switches success to practice counts and shows the estimate", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Light the beacon/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Practice results" }));
    expect(scenario()?.missions.find((m) => m.id === "beacon")?.success.kind).toBe("counts");
    expect(screen.getByText(/RoboRoute uses/)).toBeInTheDocument();
  });

  it("adds a constraint between two missions", async () => {
    renderPage();
    const form = screen.getByRole("form", { name: "Add constraint" });
    await userEvent.selectOptions(within(form).getByLabelText("First mission"), "beacon");
    await userEvent.selectOptions(within(form).getByLabelText("Relation"), "requires");
    await userEvent.selectOptions(within(form).getByLabelText("Second mission"), "crane");
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    expect(scenario()?.constraints).toEqual([
      { kind: "requires", before: "beacon", after: "crane", semantics: "succeeded" },
    ]);
  });

  it("shows problems reported by validation", async () => {
    renderPage(
      client({
        valid: false,
        issues: [
          {
            code: "constraint_cycle",
            message: "The order constraints form a cycle: a → b → a.",
            path: [],
            severity: "error",
          },
        ],
      }),
    );
    expect(await screen.findByText(/form a cycle/)).toBeInTheDocument();
  });
});
