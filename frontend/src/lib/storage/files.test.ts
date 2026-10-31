import { SIMULATE_RESULT } from "@/features/simulation/fixtures";
import { SCENARIO_A } from "@/test/fixtures";

import { experimentFile, ImportError, MAX_FILE_BYTES, parseFile, projectFile } from "./files";
import type { StoredExperiment } from "./repository";

const experiment: StoredExperiment = {
  id: "e1",
  name: "Optimal vs greedy",
  createdAt: "2026-10-31T10:00:00.000Z",
  projectId: "p1",
  request: {
    scenario: SCENARIO_A,
    plans: [{ label: "Optimal", runs: [["beacon"]] }],
    config: {
      trials: 1000,
      seed: 1,
      travel_time_cv: 0.1,
      skip_if_insufficient_time: true,
      target_score: null,
    },
  },
  result: SIMULATE_RESULT,
};

describe("RoboRoute files", () => {
  it("round-trips a project", () => {
    const text = projectFile({
      id: "p1",
      name: "Field",
      updatedAt: "2026-10-31T10:00:00.000Z",
      scenario: SCENARIO_A,
    });
    expect(JSON.parse(text)).toMatchObject({ format: "roboroute-project", schema_version: 1 });
    const parsed = parseFile(text);
    expect(parsed.kind).toBe("project");
    if (parsed.kind === "project") expect(parsed.scenario).toEqual(SCENARIO_A);
  });

  it("round-trips an experiment", () => {
    const parsed = parseFile(experimentFile(experiment));
    expect(parsed.kind).toBe("experiment");
    if (parsed.kind === "experiment") expect(parsed.experiment).toEqual(experiment);
  });

  it("accepts a bare scenario JSON (e.g. the example files)", () => {
    const parsed = parseFile(JSON.stringify(SCENARIO_A));
    expect(parsed.kind).toBe("project");
  });

  it.each([
    ["{not json", /not valid JSON/],
    [JSON.stringify({ format: "something-else", schema_version: 1 }), /not a RoboRoute file/],
    [
      JSON.stringify({ format: "roboroute-project", schema_version: 7, scenario: SCENARIO_A }),
      /version 7/,
    ],
    [JSON.stringify({ format: "roboroute-project", schema_version: 1 }), /no scenario/],
    [JSON.stringify([1, 2]), /not a RoboRoute file/],
  ])("refuses %s", (text, message) => {
    expect(() => parseFile(text)).toThrow(ImportError);
    expect(() => parseFile(text)).toThrow(message);
  });

  it("refuses files that are too large", () => {
    expect(() => parseFile(" ".repeat(MAX_FILE_BYTES + 1))).toThrow(/too large/);
  });
});
