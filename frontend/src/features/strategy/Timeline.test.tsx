import { render, screen } from "@testing-library/react";

import { Timeline } from "./Timeline";

it("sizes each step by its share of the time budget", () => {
  render(
    <Timeline
      budget={100}
      steps={[
        { kind: "travel", from_node: "start", to_node: "a", seconds: 10, provenance: "modeled" },
        { kind: "mission", from_node: "a", to_node: "a", seconds: 25, provenance: "planned" },
      ]}
      names={{ start: "Start", a: "Mission A" }}
    />,
  );
  expect(screen.getByTitle(/Travel Start → Mission A: 10 s/)).toHaveStyle({ width: "10%" });
  expect(screen.getByTitle(/Mission A: 25 s/)).toHaveStyle({ width: "25%" });
});

it("labels trips timed with a stopwatch as measured", () => {
  render(
    <Timeline
      budget={100}
      steps={[
        { kind: "travel", from_node: "start", to_node: "a", seconds: 6.5, provenance: "measured" },
        { kind: "travel", from_node: "a", to_node: "start", seconds: 7, provenance: "modeled" },
      ]}
      names={{ start: "Start", a: "Mission A" }}
    />,
  );
  expect(screen.getByTitle("Travel Start → Mission A: 6.5 s (measured)")).toBeInTheDocument();
  expect(screen.getByTitle("Travel Mission A → Start: 7 s")).toBeInTheDocument();
});
