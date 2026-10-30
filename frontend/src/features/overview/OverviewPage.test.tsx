import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { createApiClient } from "@/lib/api/client";
import { useProjectStore } from "@/stores/project";
import { SCENARIO_A } from "@/test/fixtures";

import { OverviewPage } from "./OverviewPage";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function backend() {
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/api/v1/examples") {
        return Promise.resolve(
          json(200, [
            { id: SCENARIO_A.id, name: SCENARIO_A.name, description: SCENARIO_A.description },
          ]),
        );
      }
      return Promise.resolve(json(200, SCENARIO_A));
    },
  });
}

function renderPage(client = backend()) {
  return render(
    <MemoryRouter>
      <OverviewPage client={client} />
    </MemoryRouter>,
  );
}

describe("OverviewPage", () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
  });

  it("lists the example scenarios", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /Scenario A/ })).toBeInTheDocument();
  });

  it("summarises a loaded scenario and flags fictional data", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Scenario A/ }));
    expect(await screen.findByText("Fictional data")).toBeInTheDocument();
    expect(screen.getByText("200.0 cm × 120.0 cm")).toBeInTheDocument();
    expect(screen.getByText("120 s")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open arena/ })).toHaveAttribute("href", "/arena");
  });

  it("shows an error when examples fail to load", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetch: () => Promise.reject(new TypeError("connection refused")),
    });
    renderPage(client);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Cannot reach the RoboRoute API/);
  });
});
