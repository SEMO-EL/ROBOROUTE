/**
 * Versioned files written and read by RoboRoute.
 *
 * Every file carries `format` and `schema_version`, so a saved experiment stays interpretable when
 * the software evolves: older versions are upgraded by the migrations below, newer ones are refused
 * with a clear message. Files are plain JSON data — nothing in them is ever executed. The scenario
 * inside is validated again by the backend before use.
 */
import type { Scenario } from "@/lib/api/client";

import { isStoredExperiment, type StoredExperiment, type StoredProject } from "./repository";

export const PROJECT_FORMAT = "roboroute-project";
export const EXPERIMENT_FORMAT = "roboroute-experiment";
export const CURRENT_VERSION = 1;
export const MAX_FILE_BYTES = 1_000_000;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

type Document = Record<string, unknown>;

/** Upgrades from version n to n + 1. Empty while only version 1 exists. */
const MIGRATIONS: Record<number, (doc: Document) => Document> = {};

export type ImportResult =
  | { kind: "project"; scenario: Scenario; name: string }
  | { kind: "experiment"; experiment: StoredExperiment };

export function projectFile(project: StoredProject): string {
  return JSON.stringify(
    {
      format: PROJECT_FORMAT,
      schema_version: CURRENT_VERSION,
      name: project.name,
      exported_at: new Date().toISOString(),
      scenario: project.scenario,
    },
    null,
    2,
  );
}

export function experimentFile(experiment: StoredExperiment): string {
  return JSON.stringify(
    {
      format: EXPERIMENT_FORMAT,
      schema_version: CURRENT_VERSION,
      exported_at: new Date().toISOString(),
      experiment,
    },
    null,
    2,
  );
}

function isObject(value: unknown): value is Document {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nameOf(doc: Document): string {
  return typeof doc.name === "string" && doc.name.trim() ? doc.name : "Imported field";
}

function upgrade(doc: Document): Document {
  const version = doc.schema_version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new ImportError("The file has no valid schema_version.");
  }
  if (version > CURRENT_VERSION) {
    throw new ImportError(
      `This file was made by a newer RoboRoute (file format version ${version}); this version reads up to version ${CURRENT_VERSION}.`,
    );
  }
  let current = doc;
  for (let v = version; v < CURRENT_VERSION; v += 1) {
    const migrate = MIGRATIONS[v];
    if (!migrate) throw new ImportError(`No upgrade from file format version ${v} is available.`);
    current = { ...migrate(current), schema_version: v + 1 };
  }
  return current;
}

export function parseFile(text: string): ImportResult {
  if (new Blob([text]).size > MAX_FILE_BYTES) {
    throw new ImportError(
      `The file is too large (limit ${MAX_FILE_BYTES.toLocaleString("en")} bytes).`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ImportError("The file is not valid JSON.");
  }
  if (!isObject(value)) throw new ImportError("This is not a RoboRoute file.");

  // A bare scenario (like the example files in the repository). Its own `format` field is the match
  // format (an object), whereas a RoboRoute file's `format` is a string naming the file type.
  if (
    typeof value.format !== "string" &&
    isObject(value.arena) &&
    value.schema_version !== undefined
  ) {
    const scenario = upgrade(value);
    return {
      kind: "project",
      scenario: scenario as unknown as Scenario,
      name: nameOf(scenario),
    };
  }

  if (value.format !== PROJECT_FORMAT && value.format !== EXPERIMENT_FORMAT) {
    throw new ImportError("This is not a RoboRoute file.");
  }
  const doc = upgrade(value);
  if (doc.format === PROJECT_FORMAT) {
    if (!isObject(doc.scenario)) throw new ImportError("The project file contains no scenario.");
    return {
      kind: "project",
      scenario: doc.scenario as unknown as Scenario,
      name: nameOf(doc),
    };
  }
  if (!isStoredExperiment(doc.experiment))
    throw new ImportError("The experiment file is incomplete.");
  return { kind: "experiment", experiment: doc.experiment };
}

/** Offer text to the user as a file download. */
export function download(filename: string, text: string, type = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function safeFilename(name: string): string {
  return (
    name
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "roboroute"
  );
}
