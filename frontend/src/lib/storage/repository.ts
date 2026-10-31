/**
 * Local-first persistence (design doc §3). Projects and experiments live in the user's browser —
 * the backend stores nothing — behind a small repository interface so a server-backed
 * implementation can be added later without touching the features.
 */
import type { Scenario } from "@/lib/api/client";
import type { SimulateBody, SimulateResult } from "@/lib/api/endpoints";

import { MemoryStorage } from "./memoryStorage";

export interface StoredProject {
  id: string;
  name: string;
  updatedAt: string;
  scenario: Scenario;
}

export interface StoredExperiment {
  id: string;
  name: string;
  createdAt: string;
  projectId: string | null;
  request: SimulateBody;
  result: SimulateResult;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export interface Repository<T extends { id: string }> {
  list(): { items: T[]; warnings: string[] };
  get(id: string): T | null;
  /** Throws StorageError when the browser refuses to store the item (quota, private mode). */
  save(item: T): void;
  remove(id: string): void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function isStoredProject(value: unknown): value is StoredProject {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.updatedAt === "string" &&
    isObject(value.scenario) &&
    value.scenario.schema_version === 1
  );
}

export function isStoredExperiment(value: unknown): value is StoredExperiment {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    isObject(value.request) &&
    isObject(value.result) &&
    Array.isArray(value.result.plans)
  );
}

/** localStorage when the browser allows it; otherwise memory (work then lasts only this session). */
export function browserStorage(): Storage {
  try {
    const storage = globalThis.localStorage;
    const probe = "roboroute:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return new MemoryStorage();
  }
}

export class LocalRepository<T extends { id: string }> implements Repository<T> {
  private readonly prefix: string;

  constructor(
    collection: string,
    private readonly isValid: (value: unknown) => value is T,
    private readonly storage: Storage = browserStorage(),
  ) {
    this.prefix = `roboroute:${collection}:`;
  }

  list(): { items: T[]; warnings: string[] } {
    const items: T[] = [];
    const warnings: string[] = [];
    for (let i = 0; i < this.storage.length; i += 1) {
      const key = this.storage.key(i);
      if (!key?.startsWith(this.prefix)) continue;
      const item = this.parse(key);
      if (item) items.push(item);
      else warnings.push(`Skipped an unreadable saved item (${key.slice(this.prefix.length)}).`);
    }
    return { items, warnings };
  }

  get(id: string): T | null {
    return this.parse(this.prefix + id);
  }

  save(item: T): void {
    try {
      this.storage.setItem(this.prefix + item.id, JSON.stringify(item));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new StorageError(
        `Could not save in this browser (${reason}). Export your work to a file to keep it.`,
      );
    }
  }

  remove(id: string): void {
    this.storage.removeItem(this.prefix + id);
  }

  private parse(key: string): T | null {
    const raw = this.storage.getItem(key);
    if (raw === null) return null;
    try {
      const value: unknown = JSON.parse(raw);
      return this.isValid(value) ? value : null;
    } catch {
      return null;
    }
  }
}
