import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { createApiClient } from "@/lib/api/client";
import { projectFile } from "@/lib/storage/files";
import { MemoryStorage } from "@/lib/storage/memoryStorage";
import {
  isStoredExperiment,
  isStoredProject,
  LocalRepository,
  type StoredExperiment,
  type StoredProject,
} from "@/lib/storage/repository";
import { useProjectStore } from "@/stores/project";
import { SCENARIO_A } from "@/test/fixtures";

import { Projects } from "./Projects";

function client(report: unknown = { valid: true, issues: [] }) {
  return createApiClient({
    baseUrl: "http://api.test",
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify(report), { headers: { "content-type": "application/json" } }),
      ),
  });
}

function setup(api = client()) {
  const storage = new MemoryStorage();
  const repo = new LocalRepository<StoredProject>("project", isStoredProject, storage);
  const experimentRepo = new LocalRepository<StoredExperiment>(
    "experiment",
    isStoredExperiment,
    storage,
  );
  repo.save({
    id: "p1",
    name: "Club table",
    updatedAt: "2026-10-30T09:00:00.000Z",
    scenario: { ...SCENARIO_A, name: "Club table" },
  });
  render(
    <MemoryRouter>
      <Projects repository={repo} experiments={experimentRepo} client={api} />
    </MemoryRouter>,
  );
  return { repo };
}

describe("Projects", () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
  });

  it("lists and opens saved projects", async () => {
    setup();
    const list = screen.getByRole("list", { name: "Saved projects" });
    await userEvent.click(within(list).getByRole("button", { name: "Open Club table" }));
    expect(useProjectStore.getState().scenario?.name).toBe("Club table");
    expect(useProjectStore.getState().projectId).toBe("p1");
  });

  it("asks before deleting", async () => {
    const { repo } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete Club table" }));
    expect(repo.get("p1")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(repo.get("p1")).toBeNull();
  });

  it("duplicates a project", async () => {
    const { repo } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Duplicate Club table" }));
    expect(
      repo
        .list()
        .items.map((p) => p.name)
        .sort(),
    ).toEqual(["Club table", "Club table (copy)"]);
  });

  it("imports a valid project file as a new project", async () => {
    setup();
    const file = new File(
      [
        projectFile({
          id: "x",
          name: "Imported",
          updatedAt: "",
          scenario: { ...SCENARIO_A, name: "Imported" },
        }),
      ],
      "field.json",
      { type: "application/json" },
    );
    await userEvent.upload(screen.getByLabelText("Import a RoboRoute file"), file);
    expect(await screen.findByText(/Opened “Imported”/)).toBeInTheDocument();
    expect(useProjectStore.getState().scenario?.name).toBe("Imported");
  });

  it("refuses a scenario the backend finds invalid", async () => {
    setup(
      client({
        valid: false,
        issues: [
          {
            code: "unknown_mission",
            message: "constraint #1 refers to unknown mission 'x'",
            path: [],
            severity: "error",
          },
        ],
      }),
    );
    const file = new File([JSON.stringify(SCENARIO_A)], "bad.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText("Import a RoboRoute file"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent("unknown mission 'x'");
    expect(useProjectStore.getState().scenario).toBeNull();
  });

  it("explains why a file cannot be read", async () => {
    setup();
    const file = new File(['{"format": "roboroute-project", "schema_version": 9}'], "new.json", {
      type: "application/json",
    });
    await userEvent.upload(screen.getByLabelText("Import a RoboRoute file"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent(/newer RoboRoute/);
  });
});
