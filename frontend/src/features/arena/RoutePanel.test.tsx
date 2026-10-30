import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createApiClient } from "@/lib/api/client";
import { SCENARIO_A } from "@/test/fixtures";

import { RoutePanel } from "./RoutePanel";

const okRoute = {
  status: "ok",
  message: "",
  raw_points: [
    [0.2, 0.2],
    [0.5, 0.5],
    [1.1, 1.0],
  ],
  smoothed_points: [
    [0.2, 0.2],
    [1.1, 1.0],
  ],
  length_raw: 1.5,
  length_smoothed: 1.2,
  search: { algorithm: "astar[octile,8]", expanded: 412, cost: 1.48, optimality_guaranteed: true },
  timing: { total: 7.25, translation: 5.5, rotation: 1.75, distance: 1.2, legs: [] },
  trace: null,
};

function client(body: unknown, requests: unknown[] = []) {
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: async (request) => {
      requests.push(await request.clone().json());
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    },
  });
}

describe("RoutePanel", () => {
  it("plans a route and reports length, time and search effort", async () => {
    const requests: unknown[] = [];
    const onResult = vi.fn();
    render(
      <RoutePanel scenario={SCENARIO_A} client={client(okRoute, requests)} onResult={onResult} />,
    );
    await userEvent.selectOptions(screen.getByLabelText("To"), "bridge");
    await userEvent.click(screen.getByRole("button", { name: "Plan route" }));
    expect(await screen.findByText("120.0 cm")).toBeInTheDocument();
    expect(screen.getByText("7.3 s")).toBeInTheDocument();
    expect(screen.getByText("412")).toBeInTheDocument();
    expect(screen.getByText(/Shortest grid path guaranteed/)).toBeInTheDocument();
    expect(requests[0]).toMatchObject({
      from_node: "start",
      to_node: "bridge",
      include_trace: true,
    });
    expect(onResult).toHaveBeenCalled();
  });

  it("explains why a route could not be planned", async () => {
    const failed = {
      ...okRoute,
      status: "pose_in_collision",
      message: "The goal position is too close.",
      search: null,
      timing: null,
    };
    render(<RoutePanel scenario={SCENARIO_A} client={client(failed)} onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Plan route" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The goal position is too close.");
  });

  it("disables the heuristic for Dijkstra", async () => {
    render(<RoutePanel scenario={SCENARIO_A} client={client(okRoute)} onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: "Dijkstra" }));
    expect(screen.getByLabelText("Heuristic")).toBeDisabled();
  });

  it("warns that Manhattan is not admissible with diagonal moves", async () => {
    render(<RoutePanel scenario={SCENARIO_A} client={client(okRoute)} onResult={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Heuristic"), "manhattan");
    expect(screen.getByText(/not admissible/)).toBeInTheDocument();
  });
});
