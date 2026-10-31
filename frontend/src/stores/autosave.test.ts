import { MemoryStorage } from "@/lib/storage/memoryStorage";
import { isStoredProject, LocalRepository, type StoredProject } from "@/lib/storage/repository";
import { SCENARIO_A } from "@/test/fixtures";

import { restoreLastProject, startAutosave } from "./autosave";
import { useProjectStore } from "./project";

function setup(storage = new MemoryStorage()) {
  const repo = new LocalRepository<StoredProject>("project", isStoredProject, storage);
  useProjectStore.setState(useProjectStore.getInitialState());
  const stop = startAutosave(repo, storage);
  return { repo, storage, stop };
}

describe("autosave", () => {
  it("saves every change of the current project", () => {
    const { repo, stop } = setup();
    useProjectStore.getState().replace(SCENARIO_A);
    const id = useProjectStore.getState().projectId;
    expect(id).not.toBeNull();
    useProjectStore.getState().edit({ ...SCENARIO_A, name: "Renamed" });
    expect(repo.get(id ?? "")?.scenario.name).toBe("Renamed");
    stop();
  });

  it("keeps working in memory and reports when storage is full", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const { stop } = setup(storage);
    useProjectStore.getState().replace(SCENARIO_A);
    expect(useProjectStore.getState().storageError).toMatch(/Could not save/);
    expect(useProjectStore.getState().scenario?.id).toBe(SCENARIO_A.id);
    stop();
  });

  it("restores the last project on start-up", () => {
    const { repo, storage, stop } = setup();
    useProjectStore.getState().replace({ ...SCENARIO_A, name: "Kept" });
    const id = useProjectStore.getState().projectId;
    stop();
    useProjectStore.setState(useProjectStore.getInitialState());
    restoreLastProject(repo, storage);
    expect(useProjectStore.getState().scenario?.name).toBe("Kept");
    expect(useProjectStore.getState().projectId).toBe(id);
  });
});
