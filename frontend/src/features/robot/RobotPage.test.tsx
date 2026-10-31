import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { createApiClient } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";
import { SCENARIO_A } from "@/test/fixtures";

import { RobotPage } from "./RobotPage";

function client(fit: unknown, requests: unknown[] = []) {
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: async (request) => {
      requests.push(await request.clone().json());
      return new Response(JSON.stringify(fit), { headers: { "content-type": "application/json" } });
    },
  });
}

const TWO_POINT_FIT = {
  max_speed: 1 / 3,
  acceleration: 5 / 9,
  model: "trapezoidal",
  method: "linear_least_squares",
  r_squared: 1,
  residuals: [0, 0],
  warnings: [],
};

function renderPage(api = client(TWO_POINT_FIT)) {
  return render(
    <MemoryRouter>
      <RobotPage client={api} />
    </MemoryRouter>,
  );
}

const robot = () => useProjectStore.getState().scenario?.robot;

describe("RobotPage", () => {
  beforeEach(() => {
    useProjectStore.setState({
      ...useProjectStore.getInitialState(),
      scenario: SCENARIO_A,
      status: "ready",
    });
  });

  it("edits dimensions", async () => {
    renderPage();
    const length = screen.getByLabelText("Length (cm)");
    await userEvent.clear(length);
    await userEvent.type(length, "24{Enter}");
    expect(robot()?.length).toBeCloseTo(0.24);
  });

  it("fits driving speed from stopwatch times and applies it", async () => {
    const requests: unknown[] = [];
    renderPage(client(TWO_POINT_FIT, requests));
    await userEvent.type(screen.getByLabelText("Distance 1 (cm)"), "20");
    await userEvent.type(screen.getByLabelText("Time 1 (s)"), "1.2");
    await userEvent.type(screen.getByLabelText("Distance 2 (cm)"), "100");
    await userEvent.type(screen.getByLabelText("Time 2 (s)"), "3.6");
    await userEvent.click(screen.getByRole("button", { name: "Fit driving speed" }));
    expect(requests[0]).toEqual({
      kind: "linear",
      measurements: [
        { amount: 0.2, seconds: 1.2 },
        { amount: 1, seconds: 3.6 },
      ],
    });
    expect(await screen.findByText("33.3 cm/s")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Apply to robot" }));
    expect(robot()?.linear).toMatchObject({ provenance: "calibrated" });
    expect(robot()?.linear.max_speed).toBeCloseTo(1 / 3);
  });

  it("shows the warning for a single measurement and can still apply it", async () => {
    const single = {
      ...TWO_POINT_FIT,
      acceleration: null,
      model: "constant_speed",
      method: "average_speed",
      r_squared: null,
      residuals: [0],
      warnings: ["With a single distance only the average speed can be estimated."],
    };
    renderPage(client(single));
    await userEvent.type(screen.getByLabelText("Distance 1 (cm)"), "10");
    await userEvent.type(screen.getByLabelText("Time 1 (s)"), "0.5");
    await userEvent.click(screen.getByRole("button", { name: "Fit driving speed" }));
    expect(await screen.findByText(/only the average speed/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Apply to robot" }));
    expect(robot()?.linear).toMatchObject({ acceleration: null, provenance: "calibrated" });
  });

  it("rejects incomplete measurement rows", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Distance 1 (cm)"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Fit driving speed" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/row 1/i);
  });
});

describe("RobotPage trip times", () => {
  it("records a measured trip time that replaces the modelled one", async () => {
    const user = userEvent.setup();
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    render(
      <MemoryRouter>
        <RobotPage client={client(TWO_POINT_FIT)} />
      </MemoryRouter>,
    );
    const form = screen.getByRole("form", { name: "Add a measured trip" });
    await user.selectOptions(within(form).getByLabelText("From"), "start");
    await user.selectOptions(within(form).getByLabelText("To"), "bridge");
    await user.type(within(form).getByLabelText("Seconds"), "6.5");
    await user.click(within(form).getByRole("button", { name: "Add" }));
    expect(useProjectStore.getState().scenario?.travel_overrides).toEqual([
      { from_node: "start", to_node: "bridge", seconds: 6.5 },
    ]);
    const list = screen.getByRole("list", { name: "Measured trips" });
    expect(list).toHaveTextContent("Start → Lower the bridge");
    expect(list).toHaveTextContent("6.5 s");
    await user.click(within(list).getByRole("button", { name: /Remove/ }));
    expect(useProjectStore.getState().scenario?.travel_overrides).toEqual([]);
  });

  it("refuses a time that is not a positive number", async () => {
    const user = userEvent.setup();
    useProjectStore.setState({ scenario: SCENARIO_A, status: "ready" });
    render(
      <MemoryRouter>
        <RobotPage client={client(TWO_POINT_FIT)} />
      </MemoryRouter>,
    );
    const form = screen.getByRole("form", { name: "Add a measured trip" });
    await user.type(within(form).getByLabelText("Seconds"), "-3");
    await user.click(within(form).getByRole("button", { name: "Add" }));
    expect(within(form).getByRole("alert")).toHaveTextContent(/positive/);
    expect(useProjectStore.getState().scenario?.travel_overrides).toEqual([]);
  });
});
