import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { Shell } from "./Shell";

function renderShell(path = "/") {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Shell />,
        children: [
          { index: true, element: <p>overview body</p> },
          { path: "arena", element: <p>arena body</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe("Shell", () => {
  it("lists only implemented pages in the navigation", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Main" });
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(labels).toEqual(["Overview", "Arena", "Missions", "Strategy", "Simulation"]);
  });

  it("marks the current page", () => {
    renderShell("/arena");
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("Arena");
  });

  it("renders the routed page inside the workspace", () => {
    renderShell("/arena");
    expect(within(screen.getByRole("main")).getByText("arena body")).toBeInTheDocument();
  });
});
