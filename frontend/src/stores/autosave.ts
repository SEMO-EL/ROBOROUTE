import { StorageError, type Repository, type StoredProject } from "@/lib/storage/repository";

import { useProjectStore } from "./project";

const LAST_PROJECT_KEY = "roboroute:last-project";

/**
 * Save the current project whenever its scenario changes. Returns a function that stops saving.
 * A refused write (quota, private mode) is reported through `storageError`; nothing is lost from
 * memory and the next successful save clears the error.
 */
export function startAutosave(repo: Repository<StoredProject>, storage: Storage): () => void {
  return useProjectStore.subscribe((state, previous) => {
    const { scenario, projectId } = state;
    if (!scenario || !projectId) return;
    if (scenario === previous.scenario && projectId === previous.projectId) return;
    try {
      repo.save({
        id: projectId,
        name: scenario.name,
        updatedAt: new Date().toISOString(),
        scenario,
      });
      storage.setItem(LAST_PROJECT_KEY, projectId);
      if (state.storageError) useProjectStore.setState({ storageError: null });
    } catch (error) {
      const message = error instanceof StorageError ? error.message : String(error);
      if (message !== state.storageError) useProjectStore.setState({ storageError: message });
    }
  });
}

/** Reopen the project the user last worked on, if it is still saved. */
export function restoreLastProject(repo: Repository<StoredProject>, storage: Storage): void {
  let id: string | null;
  try {
    id = storage.getItem(LAST_PROJECT_KEY);
  } catch {
    return;
  }
  const project = id ? repo.get(id) : null;
  if (project) useProjectStore.getState().replace(project.scenario, project.id);
}
