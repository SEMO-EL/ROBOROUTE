import { fireEvent, render, screen, within } from "@testing-library/react";

import { ConvergenceChart } from "./ConvergenceChart";
import { EcdfChart } from "./EcdfChart";
import { Histogram } from "./Histogram";
import { RateBars } from "./RateBars";

describe("Histogram", () => {
  const props = {
    title: "Score distribution",
    edges: [0, 20, 40, 60],
    counts: [10, 30, 60],
    xLabel: "Score (points)",
    formatBin: (low: number, high: number) => `${low}–${high} pts`,
  };

  it("draws one bar per bin, scaled to the largest count", () => {
    render(<Histogram {...props} />);
    const bars = screen.getAllByTestId("histogram-bar");
    expect(bars).toHaveLength(3);
    const [, middle = 0, tallest = 1] = bars.map((bar) => Number(bar.getAttribute("data-height")));
    expect(tallest).toBeGreaterThan(middle);
    expect(middle / tallest).toBeCloseTo(0.5, 1);
  });

  it("shows count and share on hover", () => {
    render(<Histogram {...props} />);
    const [, second] = screen.getAllByTestId("histogram-hit");
    if (!second) throw new Error("expected three bins");
    fireEvent.pointerEnter(second);
    expect(screen.getByRole("tooltip")).toHaveTextContent("20–40 pts: 30 trials (30.0%)");
  });

  it("offers the data as a table", () => {
    render(<Histogram {...props} />);
    expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("40–60 pts");
  });
});

describe("EcdfChart", () => {
  it("has a legend entry per plan", () => {
    render(
      <EcdfChart
        title="Score by plan"
        xLabel="Score"
        series={[
          {
            label: "Optimal",
            points: [
              [0, 0.1],
              [50, 0.6],
              [100, 1],
            ],
          },
          {
            label: "Greedy",
            points: [
              [0, 0.2],
              [40, 0.7],
              [90, 1],
            ],
          },
        ]}
      />,
    );
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(legend).toHaveTextContent("Optimal");
    expect(legend).toHaveTextContent("Greedy");
  });
});

describe("RateBars", () => {
  it("shows context such as how often a mission was reached", () => {
    render(
      <RateBars
        title="Success"
        rows={[{ label: "Jackpot", estimate: 0.3, low: 0.29, high: 0.31, note: "started in 66%" }]}
      />,
    );
    expect(screen.getAllByText("started in 66%").length).toBeGreaterThan(0);
  });

  it("labels each rate with its interval", () => {
    render(
      <RateBars
        title="Success"
        rows={[{ label: "Bridge", estimate: 0.8, low: 0.7, high: 0.88 }]}
      />,
    );
    const [chart] = screen.getAllByRole("list");
    if (!chart) throw new Error("expected the bar list");
    expect(within(chart).getByText("80%")).toBeInTheDocument();
    expect(screen.getByTitle(/95% interval 70%–88%/)).toBeInTheDocument();
  });
});

describe("ConvergenceChart", () => {
  const points = [10, 100, 1000].map((trials) => ({
    trials,
    mean: 50,
    interval: { low: 50 - 30 / Math.sqrt(trials), high: 50 + 30 / Math.sqrt(trials) },
  }));

  it("labels the model reference line and lists every checkpoint in the table", () => {
    render(<ConvergenceChart title="Running mean" points={points} reference={48} />);
    expect(screen.getByText(/planning model 48\.0/i)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 3);
    // Half-width × √n stays constant when the interval shrinks like 1/√n.
    expect(within(table).getAllByText("30.0")).toHaveLength(3);
  });

  it("shows a checkpoint's interval on hover", () => {
    render(<ConvergenceChart title="Running mean" points={points} reference={null} />);
    fireEvent.pointerEnter(screen.getByTestId("checkpoint-100"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("100 trials");
    expect(screen.getByRole("tooltip")).toHaveTextContent("47.0 – 53.0");
  });
});
