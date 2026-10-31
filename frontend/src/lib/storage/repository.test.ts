import { SCENARIO_A } from "@/test/fixtures";

import { MemoryStorage } from "./memoryStorage";
import { LocalRepository, StorageError, type StoredProject, isStoredProject } from "./repository";

const project = (id: string, name = "Field"): StoredProject => ({
  id,
  name,
  updatedAt: "2026-10-31T10:00:00.000Z",
  scenario: SCENARIO_A,
});

describe("LocalRepository", () => {
  it("saves, lists, gets and removes", () => {
    const repo = new LocalRepository("project", isStoredProject, new MemoryStorage());
    repo.save(project("a"));
    repo.save(project("b", "Other"));
    expect(
      repo
        .list()
        .items.map((p) => p.id)
        .sort(),
    ).toEqual(["a", "b"]);
    expect(repo.get("b")?.name).toBe("Other");
    repo.remove("a");
    expect(repo.get("a")).toBeNull();
  });

  it("skips corrupted entries with a warning and still lists the rest", () => {
    const storage = new MemoryStorage();
    const repo = new LocalRepository("project", isStoredProject, storage);
    repo.save(project("good"));
    storage.setItem("roboroute:project:broken", "{not json");
    storage.setItem("roboroute:project:wrong", JSON.stringify({ id: "wrong" }));
    const { items, warnings } = repo.list();
    expect(items.map((p) => p.id)).toEqual(["good"]);
    expect(warnings).toHaveLength(2);
  });

  it("reports a full storage as a StorageError", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const repo = new LocalRepository("project", isStoredProject, storage);
    expect(() => {
      repo.save(project("a"));
    }).toThrow(StorageError);
  });

  it("ignores keys that belong to other collections", () => {
    const storage = new MemoryStorage();
    storage.setItem("roboroute:experiment:x", JSON.stringify(project("x")));
    storage.setItem("unrelated", "1");
    expect(new LocalRepository("project", isStoredProject, storage).list().items).toEqual([]);
  });
});
