/** The app's repositories, backed by the browser's storage. */
import {
  browserStorage,
  isStoredExperiment,
  isStoredProject,
  LocalRepository,
  type StoredExperiment,
  type StoredProject,
} from "@/lib/storage/repository";

export const storage = browserStorage();
export const projects = new LocalRepository<StoredProject>("project", isStoredProject, storage);
export const experiments = new LocalRepository<StoredExperiment>(
  "experiment",
  isStoredExperiment,
  storage,
);
