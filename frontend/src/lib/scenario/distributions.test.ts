import { describeDistribution, distributionMean } from "./distributions";

describe("distributions", () => {
  it("computes means like the backend models", () => {
    expect(distributionMean({ kind: "fixed", value: 4 })).toBe(4);
    expect(distributionMean({ kind: "triangular", low: 3, mode: 4, high: 8 })).toBe(5);
    expect(distributionMean({ kind: "lognormal", median: 10, gsd: 1.2 })).toBeCloseTo(
      10 * Math.exp(Math.log(1.2) ** 2 / 2),
      12,
    );
    expect(distributionMean({ kind: "empirical", samples: [4, 5, 9] })).toBe(6);
  });

  it("describes each kind in words with its parameters", () => {
    expect(describeDistribution({ kind: "fixed", value: 4 })).toBe("always 4.0 s");
    expect(describeDistribution({ kind: "triangular", low: 3, mode: 4, high: 8 })).toBe(
      "triangular: best 3.0 s, usual 4.0 s, worst 8.0 s",
    );
    expect(describeDistribution({ kind: "lognormal", median: 10, gsd: 1.2 })).toBe(
      "lognormal: typical 10.0 s, spread ×1.20",
    );
    expect(describeDistribution({ kind: "empirical", samples: [4, 5, 9] })).toBe(
      "one of 3 measured times, picked at random",
    );
  });
});
