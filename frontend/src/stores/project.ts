import { create } from "zustand";

import { api, unwrap, type Scenario } from "@/lib/api/client";

type ApiClient = typeof api;

const HISTORY_LIMIT = 100;

export interface ProjectState {
  scenario: Scenario | null;
  /** Identity of the saved project the scenario belongs to (local storage key). */
  projectId: string | null;
  /** Set when the browser refused to save; work is kept in memory until it succeeds again. */
  storageError: string | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** Earlier versions (oldest first) for undo, and undone versions for redo. */
  past: Scenario[];
  future: Scenario[];
  loadExample: (id: string, client?: ApiClient) => Promise<void>;
  /** Replace the scenario and start a fresh history; without an id a new project is created. */
  replace: (scenario: Scenario, projectId?: string) => void;
  /** A user edit: becomes one undo step. */
  edit: (next: Scenario) => void;
  /** Show an intermediate state (e.g. while dragging) without recording history. */
  preview: (next: Scenario) => void;
  /** Finish a gesture that started at `before`: records one undo step if anything changed. */
  commit: (before: Scenario) => void;
  undo: () => void;
  redo: () => void;
}

export function newProjectId(): string {
  return globalThis.crypto.randomUUID();
}

function bounded(history: Scenario[]): Scenario[] {
  return history.length > HISTORY_LIMIT ? history.slice(history.length - HISTORY_LIMIT) : history;
}

/**
 * The scenario being worked on, with undo/redo. A failed load keeps the previous scenario so that a
 * network hiccup never discards the user's work.
 */
export const useProjectStore = create<ProjectState>()((set, get) => ({
  scenario: null,
  projectId: null,
  storageError: null,
  status: "idle",
  error: null,
  past: [],
  future: [],
  loadExample: async (id, client = api) => {
    set({ status: "loading", error: null });
    try {
      const scenario = await unwrap(
        client.GET("/api/v1/examples/{example_id}", { params: { path: { example_id: id } } }),
      );
      get().replace(scenario);
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  },
  replace: (scenario, projectId) => {
    set({
      scenario,
      projectId: projectId ?? newProjectId(),
      status: "ready",
      error: null,
      past: [],
      future: [],
    });
  },
  edit: (next) => {
    const { scenario, past } = get();
    if (!scenario || next === scenario) return;
    set({ scenario: next, past: bounded([...past, scenario]), future: [] });
  },
  preview: (next) => {
    set({ scenario: next });
  },
  commit: (before) => {
    const { scenario, past } = get();
    if (!scenario || scenario === before) return;
    set({ past: bounded([...past, before]), future: [] });
  },
  undo: () => {
    const { scenario, past, future } = get();
    const previous = past[past.length - 1];
    if (!scenario || !previous) return;
    set({ scenario: previous, past: past.slice(0, -1), future: [scenario, ...future] });
  },
  redo: () => {
    const { scenario, past, future } = get();
    const [next, ...rest] = future;
    if (!scenario || !next) return;
    set({ scenario: next, past: bounded([...past, scenario]), future: rest });
  },
}));
